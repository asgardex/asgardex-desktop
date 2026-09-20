import * as RD from '@devexperts/remote-data-ts'
import {
  RunebondIntegratorsApiClient,
  createIntegratorsClient,
  ChurnPoint as ApiChurnPoint
} from '@runebond/integrators-client'
import { Address, baseAmount, bn } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { envOrDefault } from '../../../shared/utils/env'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { triggerStream } from '../../helpers/stateHelper'
import {
  BondPayout,
  ChurnPoint,
  NodeHistory,
  NodeHistoryLD,
  NodeProviderRewards,
  NodeProviderRewardsLD,
  ProviderRewards,
  ProviderRewardsLD
} from './types'

export const RUNEBOND_URL = 'https://runebond.com'

export const RUNEBOND_API_PENDING = 'RUNEBOND_API_PENDING'

const INTEGRATORS_URL = envOrDefault(import.meta.env.VITE_RUNEBOND_INTEGRATORS_URL, '')
const INTEGRATORS_API_KEY = envOrDefault(import.meta.env.VITE_RUNEBOND_INTEGRATORS_API_KEY, '')

const HISTORY_CHURNS = 12
const PAYOUTS_LIMIT = 500
const DEFAULT_CHURN_INTERVAL_MS = 3 * 24 * 3600 * 1000
const YEAR_MS = 365 * 24 * 3600 * 1000

const oClient: O.Option<RunebondIntegratorsApiClient> =
  INTEGRATORS_URL !== '' && INTEGRATORS_API_KEY !== '' && INTEGRATORS_API_KEY !== 'XXX'
    ? O.some(createIntegratorsClient({ baseUrl: INTEGRATORS_URL, apiKey: INTEGRATORS_API_KEY }))
    : O.none

const pendingError = () => Error(RUNEBOND_API_PENDING)

export const isRunebondPendingError = (error: Error): boolean => error.message === RUNEBOND_API_PENDING

const { stream$: reloadRewards$, trigger: reloadRewards } = triggerStream()

const CACHE_GRACE_MS = 60_000
const REQUEST_TIMEOUT_MS = 20_000

const toBase = (value: string) => baseAmount(bn(value), THORCHAIN_DECIMAL)

const toChurnPoint = ({ blockNumber, timestamp, amount }: ApiChurnPoint): ChurnPoint => ({
  churnHeight: blockNumber,
  date: new Date(timestamp),
  amount: toBase(amount)
})

const mergeSeries = (series: ChurnPoint[][]): ChurnPoint[] => {
  const byBlock = new Map<number, ChurnPoint>()
  for (const points of series) {
    for (const point of points) {
      const existing = byBlock.get(point.churnHeight)
      byBlock.set(point.churnHeight, existing ? { ...existing, amount: existing.amount.plus(point.amount) } : point)
    }
  }
  return [...byBlock.values()].sort((a, b) => a.churnHeight - b.churnHeight).slice(-HISTORY_CHURNS)
}

const streamCache = new Map<string, Rx.Observable<unknown>>()

const addressesKey = (addresses: Address[]): string => Array.from(new Set(addresses)).sort().join('|')

const cached = <T>(key: string, create: () => Rx.Observable<T>): Rx.Observable<T> => {
  const existing = streamCache.get(key) as Rx.Observable<T> | undefined
  if (existing) return existing
  const created = create()
  streamCache.set(key, created)
  return created
}

const liveRequest = <T>(
  request: (client: RunebondIntegratorsApiClient) => Promise<T>
): Rx.Observable<RD.RemoteData<Error, T>> =>
  FP.pipe(
    oClient,
    O.fold(
      () => Rx.of(RD.failure<Error, T>(pendingError())).pipe(RxOp.shareReplay(1)),
      (client) =>
        reloadRewards$.pipe(
          RxOp.switchMap(() =>
            Rx.from(request(client)).pipe(
              RxOp.timeout(REQUEST_TIMEOUT_MS),
              RxOp.map((result) => RD.success<Error, T>(result)),
              RxOp.catchError((error) =>
                Rx.of(RD.failure<Error, T>(error instanceof Error ? error : Error(String(error))))
              ),
              RxOp.startWith(RD.pending)
            )
          ),
          RxOp.share({
            connector: () => new Rx.ReplaySubject<RD.RemoteData<Error, T>>(1),
            resetOnRefCountZero: () => Rx.timer(CACHE_GRACE_MS)
          })
        )
    )
  )

const providerRewards$ = (addresses: Address[]): ProviderRewardsLD =>
  cached(`providerRewards|${addressesKey(addresses)}`, () =>
    liveRequest(async (client): Promise<ProviderRewards> => {
      const results = await Promise.all(
        addresses.map((address) => client.bondProviders.getProviderRewards(address, PAYOUTS_LIMIT, 0, HISTORY_CHURNS))
      )

      const allPayouts: BondPayout[] = FP.pipe(
        results,
        A.chain((result) =>
          result.payouts.map(({ blockNumber, timestamp, nodeAddress, netAmount }) => ({
            nodeAddress,
            amount: toBase(netAmount),
            churnHeight: blockNumber,
            date: new Date(timestamp)
          }))
        ),
        (all) => all.sort((a, b) => b.churnHeight - a.churnHeight)
      )

      const payouts = allPayouts.filter(({ amount }) => amount.gt(0))

      const series = mergeSeries(results.map((result) => result.series.map(toChurnPoint)))

      const totalPaid = results.reduce(
        (acc, result) => acc.plus(toBase(result.totals.totalPaid)),
        baseAmount(0, THORCHAIN_DECIMAL)
      )

      const churnCount =
        results.length === 1
          ? results[0].totals.churnCount
          : new Set(allPayouts.map(({ churnHeight }) => churnHeight)).size

      const lastChurnTotal = FP.pipe(
        A.last(series),
        O.map(({ amount }) => amount)
      )

      return { totalPaid, churnCount, lastChurnTotal, series, payouts }
    })
  )

const nodeProviderRewards$ = (addresses: Address[]): NodeProviderRewardsLD =>
  cached(`nodeProviderRewards|${addressesKey(addresses)}`, () =>
    liveRequest(async (client): Promise<NodeProviderRewards[]> => {
      const results = await Promise.all(
        addresses.map((address) => client.bondProviders.getProviderRewardsByNode(address, HISTORY_CHURNS))
      )

      type Accumulated = { totalPaid: ReturnType<typeof toBase>; churnsPaid: number; series: ChurnPoint[][] }
      const byNode = new Map<string, Accumulated>()

      for (const result of results) {
        for (const node of result.nodes) {
          const entry = byNode.get(node.nodeAddress)
          const nodeSeries = node.series.map(toChurnPoint)
          if (entry) {
            entry.totalPaid = entry.totalPaid.plus(toBase(node.totalPaid))
            entry.churnsPaid = Math.max(entry.churnsPaid, node.churnsPaid)
            entry.series.push(nodeSeries)
          } else {
            byNode.set(node.nodeAddress, {
              totalPaid: toBase(node.totalPaid),
              churnsPaid: node.churnsPaid,
              series: [nodeSeries]
            })
          }
        }
      }

      return [...byNode.entries()].map(([nodeAddress, entry]) => {
        const series = mergeSeries(entry.series)
        return {
          nodeAddress,
          churnsPaid: entry.churnsPaid,
          totalPaid: entry.totalPaid,
          lastPayout: FP.pipe(
            A.last(series),
            O.map(({ amount }) => amount)
          ),
          series
        }
      })
    })
  )

const nodeHistory$ = (nodeAddress: Address, providerAddresses: Address[]): NodeHistoryLD =>
  cached(`nodeHistory|${nodeAddress}|${addressesKey(providerAddresses)}`, () =>
    liveRequest(async (client): Promise<NodeHistory> => {
      const [nodeHistory, bondHistories, rewardsByNode] = await Promise.all([
        client.nodes.getNodeHistory(nodeAddress, HISTORY_CHURNS),
        Promise.all(
          providerAddresses.map((address) =>
            client.bondProviders.getProviderBondHistory(address, nodeAddress, HISTORY_CHURNS)
          )
        ),
        Promise.all(
          providerAddresses.map((address) => client.bondProviders.getProviderRewardsByNode(address, HISTORY_CHURNS))
        )
      ])

      const apySeries = nodeHistory.points.map((point, index) => {
        const date = new Date(point.timestamp)
        const previous = nodeHistory.points[index - 1]
        const intervalMs = previous
          ? Math.max(date.getTime() - new Date(previous.timestamp).getTime(), 1)
          : DEFAULT_CHURN_INTERVAL_MS
        const bond = bn(point.totalBond)
        const apy = bond.gt(0) ? Math.pow(1 + bn(point.earnings).div(bond).toNumber(), YEAR_MS / intervalMs) - 1 : 0
        return { churnHeight: point.blockNumber, date, apy: Number.isFinite(apy) ? apy : 0 }
      })

      const bondByBlock = new Map<number, { date: Date; bond: ReturnType<typeof toBase> }>()
      for (const history of bondHistories) {
        for (const point of history.points) {
          const existing = bondByBlock.get(point.blockNumber)
          const amount = toBase(point.bondAmount)
          bondByBlock.set(point.blockNumber, {
            date: new Date(point.timestamp),
            bond: existing ? existing.bond.plus(amount) : amount
          })
        }
      }
      const bondSeries = [...bondByBlock.entries()]
        .map(([churnHeight, { date, bond }]) => ({ churnHeight, date, bond }))
        .sort((a, b) => a.churnHeight - b.churnHeight)
        .slice(-HISTORY_CHURNS)

      const earningsSeries = mergeSeries(
        rewardsByNode.map((result) =>
          FP.pipe(
            O.fromNullable(result.nodes.find((node) => node.nodeAddress === nodeAddress)),
            O.map((node) => node.series.map(toChurnPoint)),
            O.getOrElse<ChurnPoint[]>(() => [])
          )
        )
      )

      return { apySeries, bondSeries, earningsSeries }
    })
  )

export { providerRewards$, nodeProviderRewards$, nodeHistory$, reloadRewards }
