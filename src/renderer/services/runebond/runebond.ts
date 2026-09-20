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

/**
 * RUNEBond data service, backed by the RUNEBond Integrators API
 * (`@runebond/integrators-client`).
 *
 * THORNode does not expose per-provider reward history (rewards are credited to
 * the provider bond at churn without an on-chain tx), so historical data —
 * "paid last churn", payout history, node APY series — comes from RUNEBond.
 *
 * When `VITE_RUNEBOND_INTEGRATORS_URL` / `VITE_RUNEBOND_INTEGRATORS_API_KEY`
 * are not configured, every stream fails with `RUNEBOND_API_PENDING` and the
 * views degrade to their "not available" state.
 */
export const RUNEBOND_API_PENDING = 'RUNEBOND_API_PENDING'

const INTEGRATORS_URL = envOrDefault(import.meta.env.VITE_RUNEBOND_INTEGRATORS_URL, '')
const INTEGRATORS_API_KEY = envOrDefault(import.meta.env.VITE_RUNEBOND_INTEGRATORS_API_KEY, '')

/** number of churns shown in history charts (mirrors the designs) */
const HISTORY_CHURNS = 12
/** payout page size — enough to cover the whole history (churns are ~weekly) */
const PAYOUTS_LIMIT = 500
/** fallback churn interval (~3 days) when a series has a single point */
const DEFAULT_CHURN_INTERVAL_MS = 3 * 24 * 3600 * 1000
const YEAR_MS = 365 * 24 * 3600 * 1000

const oClient: O.Option<RunebondIntegratorsApiClient> =
  INTEGRATORS_URL !== '' && INTEGRATORS_API_KEY !== '' && INTEGRATORS_API_KEY !== 'XXX'
    ? O.some(createIntegratorsClient({ baseUrl: INTEGRATORS_URL, apiKey: INTEGRATORS_API_KEY }))
    : O.none

const pendingError = () => Error(RUNEBOND_API_PENDING)

export const isRunebondPendingError = (error: Error): boolean => error.message === RUNEBOND_API_PENDING

const { stream$: reloadRewards$, trigger: reloadRewards } = triggerStream()

const toBase = (value: string) => baseAmount(bn(value), THORCHAIN_DECIMAL)

const toChurnPoint = ({ blockNumber, timestamp, amount }: ApiChurnPoint): ChurnPoint => ({
  churnHeight: blockNumber,
  date: new Date(timestamp),
  amount: toBase(amount)
})

/** merges per-churn series of several addresses, summing amounts per churn (asc) */
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

/**
 * Streams are cached per request key so a view that unmounts and mounts
 * again (e.g. switching bonds tabs) replays the last result instead of
 * flashing a pending state and hitting the API again. `reloadRewards`
 * still refreshes every cached stream.
 */
const streamCache = new Map<string, Rx.Observable<unknown>>()

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
              RxOp.map((result) => RD.success<Error, T>(result)),
              RxOp.catchError((error) =>
                Rx.of(RD.failure<Error, T>(error instanceof Error ? error : Error(String(error))))
              ),
              RxOp.startWith(RD.pending)
            )
          ),
          RxOp.shareReplay(1)
        )
    )
  )

const providerRewards$ = (addresses: Address[]): ProviderRewardsLD =>
  cached(`providerRewards|${addresses.join('|')}`, () =>
    liveRequest(async (client): Promise<ProviderRewards> => {
      const results = await Promise.all(
        addresses.map((address) => client.bondProviders.getProviderRewards(address, PAYOUTS_LIMIT, 0, HISTORY_CHURNS))
      )

      // every payout reported by RUNEBond, including zero-amount ones (e.g. a
      // churn the node was not rewarded for) — used for the churn count
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

      // the payout list (and its CSV export) only shows what was actually paid
      const payouts = allPayouts.filter(({ amount }) => amount.gt(0))

      const series = mergeSeries(results.map((result) => result.series.map(toChurnPoint)))

      const totalPaid = results.reduce(
        (acc, result) => acc.plus(toBase(result.totals.totalPaid)),
        baseAmount(0, THORCHAIN_DECIMAL)
      )

      // distinct churns across addresses, derived from the (practically
      // complete) payout list
      const churnCount = new Set(allPayouts.map(({ churnHeight }) => churnHeight)).size

      const lastChurnTotal = FP.pipe(
        A.last(series),
        O.map(({ amount }) => amount)
      )

      return { totalPaid, churnCount, lastChurnTotal, series, payouts }
    })
  )

const nodeProviderRewards$ = (addresses: Address[]): NodeProviderRewardsLD =>
  cached(`nodeProviderRewards|${addresses.join('|')}`, () =>
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
  cached(`nodeHistory|${nodeAddress}|${providerAddresses.join('|')}`, () =>
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

      // node APY per churn: earnings of the churn annualized over the interval
      // since the previous one
      const apySeries = nodeHistory.points.map((point, index) => {
        const date = new Date(point.timestamp)
        const previous = nodeHistory.points[index - 1]
        const intervalMs = previous
          ? Math.max(date.getTime() - new Date(previous.timestamp).getTime(), 1)
          : DEFAULT_CHURN_INTERVAL_MS
        const bond = bn(point.totalBond)
        const apy = bond.gt(0)
          ? bn(point.earnings)
              .div(bond)
              .times(YEAR_MS / intervalMs)
              .toNumber()
          : 0
        return { churnHeight: point.blockNumber, date, apy }
      })

      // provider bond over churns, summed across the wallet addresses
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

      // provider earnings per churn on this node, summed across addresses
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
