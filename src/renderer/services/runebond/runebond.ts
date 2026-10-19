import * as RD from '@devexperts/remote-data-ts'
import {
  ApiError,
  RunebondIntegratorsApiClient,
  createIntegratorsClient,
  ChurnPoint as ApiChurnPoint,
  LastChurnPayment as ApiLastChurnPayment,
  WhitelistRequestCounts as ApiWhitelistRequestCounts,
  WhitelistRequestItem as ApiWhitelistRequestItem
} from '@runebond/integrators-client'
import { Address, BaseAmount, baseAmount, bn } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { envOrDefault } from '../../../shared/utils/env'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { triggerStream } from '../../helpers/stateHelper'
import {
  BondPayout,
  ChurnPoint,
  LastChurnPayout,
  NodeHistory,
  NodeHistoryLD,
  NodeListing,
  NodeListingLD,
  NodeProviderRewards,
  NodeProviderRewardsLD,
  NodeProviders,
  NodeProvidersLD,
  NodeWhitelistRequests,
  NodeWhitelistRequestsLD,
  OperatorFinderFeeVault,
  OperatorFinderFeeVaultLD,
  OperatorRewards,
  OperatorRewardsLD,
  OperatorWhitelistRequests,
  OperatorWhitelistRequestsLD,
  ProviderRewards,
  ProviderRewardsLD,
  WhitelistRequest,
  WhitelistRequestCounts
} from './types'

export const RUNEBOND_URL = 'https://runebond.com'

export const RUNEBOND_LISTING_ADDRESS: Address = 'thor1xazgmh7sv0p393t9ntj6q9p52ahycc8jjlaap9'

export const RUNEBOND_LISTING_MIN_AMOUNT: BaseAmount = baseAmount(10_000_000, THORCHAIN_DECIMAL)

const INTEGRATORS_URL = envOrDefault(import.meta.env.VITE_RUNEBOND_INTEGRATORS_URL, '')
const INTEGRATORS_API_KEY = envOrDefault(import.meta.env.VITE_RUNEBOND_INTEGRATORS_API_KEY, '')

const HISTORY_CHURNS = 12
const PAYOUTS_LIMIT = 500
const WHITELIST_REQUESTS_LIMIT = 200
const DEFAULT_CHURN_INTERVAL_MS = 3 * 24 * 3600 * 1000
const YEAR_MS = 365 * 24 * 3600 * 1000

const oClient: O.Option<RunebondIntegratorsApiClient> =
  INTEGRATORS_URL !== '' && INTEGRATORS_API_KEY !== '' && INTEGRATORS_API_KEY !== 'XXX'
    ? O.some(createIntegratorsClient({ baseUrl: INTEGRATORS_URL, apiKey: INTEGRATORS_API_KEY }))
    : O.none

const notConfiguredError = () => Error('RUNEBond data service is not configured')

const { stream$: reloadRunebond$, trigger: reloadRunebond } = triggerStream()

const reloadRewards = reloadRunebond

const CACHE_GRACE_MS = 60_000
const REQUEST_TIMEOUT_MS = 20_000

const parseBaseAmount = (value: string) => baseAmount(bn(value), THORCHAIN_DECIMAL)

const toChurnPoint = ({ blockNumber, timestamp, amount }: ApiChurnPoint): ChurnPoint => ({
  churnHeight: blockNumber,
  date: new Date(timestamp),
  amount: parseBaseAmount(amount)
})

const toLastChurnPayout = (payment: ApiLastChurnPayment | null): LastChurnPayout | null =>
  payment
    ? {
        blockNumber: payment.blockNumber,
        timestamp: payment.timestamp,
        date: new Date(payment.timestamp),
        amount: parseBaseAmount(payment.amount)
      }
    : null

const toWhitelistRequest = (item: ApiWhitelistRequestItem): WhitelistRequest => ({
  id: item.id,
  nodeAddress: item.nodeAddress,
  providerAddress: item.providerAddress,
  intendedBond: parseBaseAmount(item.intendedBond),
  realBond: parseBaseAmount(item.realBond),
  status: `${item.status}`,
  requestedAt: item.requestedAt,
  requestedDate: new Date(item.requestedAt),
  height: item.height,
  txId: item.txId
})

const toWhitelistRequestCounts = ({
  pending,
  approved,
  bonded,
  rejected
}: ApiWhitelistRequestCounts): WhitelistRequestCounts => ({
  pending,
  approved,
  bonded,
  rejected
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
      () => Rx.of(RD.failure<Error, T>(notConfiguredError())).pipe(RxOp.shareReplay(1)),
      (client) =>
        reloadRunebond$.pipe(
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
            amount: parseBaseAmount(netAmount),
            churnHeight: blockNumber,
            date: new Date(timestamp)
          }))
        ),
        (all) => all.sort((a, b) => b.churnHeight - a.churnHeight)
      )

      const payouts = allPayouts.filter(({ amount }) => amount.gt(0))

      const series = mergeSeries(results.map((result) => result.series.map(toChurnPoint)))

      const totalPaid = results.reduce(
        (acc, result) => acc.plus(parseBaseAmount(result.totals.totalPaid)),
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

      type Accumulated = { totalPaid: ReturnType<typeof parseBaseAmount>; churnsPaid: number; series: ChurnPoint[][] }
      const byNode = new Map<string, Accumulated>()

      for (const result of results) {
        for (const node of result.nodes) {
          const entry = byNode.get(node.nodeAddress)
          const nodeSeries = node.series.map(toChurnPoint)
          if (entry) {
            entry.totalPaid = entry.totalPaid.plus(parseBaseAmount(node.totalPaid))
            entry.churnsPaid = Math.max(entry.churnsPaid, node.churnsPaid)
            entry.series.push(nodeSeries)
          } else {
            byNode.set(node.nodeAddress, {
              totalPaid: parseBaseAmount(node.totalPaid),
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

      const bondByBlock = new Map<number, { date: Date; bond: ReturnType<typeof parseBaseAmount> }>()
      for (const history of bondHistories) {
        for (const point of history.points) {
          const existing = bondByBlock.get(point.blockNumber)
          const amount = parseBaseAmount(point.bondAmount)
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

      const nodeEarningsSeries: ChurnPoint[] = nodeHistory.points
        .map(({ blockNumber, timestamp, earnings }) => ({
          churnHeight: blockNumber,
          date: new Date(timestamp),
          amount: parseBaseAmount(earnings)
        }))
        .slice(-HISTORY_CHURNS)

      return { apySeries, bondSeries, earningsSeries, nodeEarningsSeries }
    })
  )

const operatorRewards$ = (address: Address): OperatorRewardsLD =>
  cached(`operatorRewards|${address}`, () =>
    liveRequest(async (client): Promise<OperatorRewards> => {
      const result = await client.nodeOperators.getOperatorRewards(address, PAYOUTS_LIMIT, 0, HISTORY_CHURNS)
      return {
        address: result.address,
        totals: {
          totalPaid: parseBaseAmount(result.totals.totalPaid),
          churnCount: result.totals.churnCount,
          lastChurn: toLastChurnPayout(result.totals.lastChurn)
        },
        series: result.series
          .map(toChurnPoint)
          .sort((a, b) => a.churnHeight - b.churnHeight)
          .slice(-HISTORY_CHURNS),
        byNode: result.byNode.map(({ nodeAddress, totalPaid, churnsPaid, lastPayout }) => ({
          nodeAddress,
          totalPaid: parseBaseAmount(totalPaid),
          churnsPaid,
          lastPayout: toLastChurnPayout(lastPayout)
        })),
        payouts: result.payouts.map(({ blockNumber, timestamp, nodeAddress, commissionAmount, commissionBps }) => ({
          blockNumber,
          timestamp,
          date: new Date(timestamp),
          nodeAddress,
          commissionAmount: parseBaseAmount(commissionAmount),
          commissionBps
        })),
        payoutsTotal: result.pagination.total
      }
    })
  )

const nodeProviders$ = (nodeAddress: Address): NodeProvidersLD =>
  cached(`nodeProviders|${nodeAddress}`, () =>
    liveRequest(async (client): Promise<NodeProviders> => {
      const result = await client.nodes.getNodeProviders(nodeAddress, HISTORY_CHURNS)
      return {
        nodeAddress: result.nodeAddress,
        blockNumber: result.blockNumber,
        timestamp: result.timestamp,
        date: new Date(result.timestamp),
        providers: result.providers.map((provider) => ({
          providerAddress: provider.providerAddress,
          bondAmount: parseBaseAmount(provider.bondAmount),
          firstSeenBlockNumber: provider.firstSeenBlockNumber,
          churnsBonded: provider.churnsBonded,
          churnsSinceFirstSeen: provider.churnsSinceFirstSeen,
          lastPayout: toLastChurnPayout(provider.lastPayout)
        }))
      }
    })
  )

const warnedMismatches = new Set<string>()

const warnMismatchOnce = (key: string, message: string) => {
  if (warnedMismatches.has(key)) return
  warnedMismatches.add(key)
  // eslint-disable-next-line no-console
  console.warn(message)
}

const nodeListing$ = (nodeAddress: Address): NodeListingLD =>
  cached(`nodeListing|${nodeAddress}`, () =>
    liveRequest(async (client): Promise<NodeListing> => {
      const result = await client.nodes.getNodeListing(nodeAddress)
      return {
        nodeAddress: result.nodeAddress,
        listed: result.listed,
        listing: result.listing
          ? {
              operatorAddress: result.listing.operatorAddress,
              minBond: parseBaseAmount(result.listing.minBond),
              targetTotalBond:
                result.listing.targetTotalBond !== null ? parseBaseAmount(result.listing.targetTotalBond) : null,
              feeBps: result.listing.feeBps,
              name: result.listing.name,
              description: result.listing.description,
              listedAt: result.listing.listedAt,
              listedDate: new Date(result.listing.listedAt),
              listedHeight: result.listing.listedHeight,
              txId: result.listing.txId,
              delisted: result.listing.delisted,
              delistedTxId: result.listing.delistedTxId,
              delistReason: result.listing.delistReason ? `${result.listing.delistReason}` : null
            }
          : null
      }
    })
  )

const nodeWhitelistRequests$ = (nodeAddress: Address): NodeWhitelistRequestsLD =>
  cached(`nodeWhitelistRequests|${nodeAddress}`, () =>
    liveRequest(async (client): Promise<NodeWhitelistRequests> => {
      const result = await client.nodes.getNodeWhitelistRequests(nodeAddress, undefined, WHITELIST_REQUESTS_LIMIT, 0)
      return {
        nodeAddress: result.nodeAddress,
        counts: toWhitelistRequestCounts(result.counts),
        requests: result.requests.map(toWhitelistRequest),
        total: result.pagination.total
      }
    })
  )

const operatorWhitelistRequests$ = (address: Address): OperatorWhitelistRequestsLD =>
  cached(`operatorWhitelistRequests|${address}`, () =>
    liveRequest(async (client): Promise<OperatorWhitelistRequests> => {
      const result = await client.nodeOperators.getOperatorWhitelistRequests(
        address,
        undefined,
        WHITELIST_REQUESTS_LIMIT,
        0
      )
      return {
        address: result.address,
        counts: toWhitelistRequestCounts(result.counts),
        nodes: result.nodes.map(({ nodeAddress, pending }) => ({ nodeAddress, pending })),
        requests: result.requests.map(toWhitelistRequest),
        total: result.pagination.total
      }
    })
  )

const isNotFound = (error: unknown): boolean =>
  error instanceof ApiError
    ? error.status === 404
    : typeof error === 'object' && error !== null && 'status' in error && error.status === 404

const unknownFinderFeeVault = (address: Address): OperatorFinderFeeVault => ({
  address,
  known: false,
  balance: baseAmount(0, THORCHAIN_DECIMAL),
  depleted: false,
  level: 'ok',
  listedNodes: 0,
  delistedByVault: 0,
  lastUpdatedAt: null
})

const operatorFinderFeeVault$ = (address: Address): OperatorFinderFeeVaultLD =>
  cached(`operatorFinderFeeVault|${address}`, () =>
    liveRequest(async (client): Promise<OperatorFinderFeeVault> => {
      try {
        const result = await client.nodeOperators.getOperatorFinderFeeVault(address)
        if (result.topup.address.toLowerCase() !== RUNEBOND_LISTING_ADDRESS.toLowerCase()) {
          warnMismatchOnce(
            'topupAddress',
            `RUNEBond vault returned top-up address ${result.topup.address}, ignoring it and using ${RUNEBOND_LISTING_ADDRESS}`
          )
        }
        return {
          address: result.address,
          known: true,
          balance: parseBaseAmount(result.balance),
          depleted: result.depleted,
          level: `${result.level}`,
          listedNodes: result.listedNodes,
          delistedByVault: result.delistedByVault,
          lastUpdatedAt: result.lastUpdatedAt
        }
      } catch (error) {
        if (isNotFound(error)) return unknownFinderFeeVault(address)
        throw error
      }
    })
  )

export {
  providerRewards$,
  nodeProviderRewards$,
  nodeHistory$,
  operatorRewards$,
  nodeProviders$,
  nodeListing$,
  nodeWhitelistRequests$,
  operatorWhitelistRequests$,
  operatorFinderFeeVault$,
  reloadRunebond,
  reloadRewards
}
