import { useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { array as A } from 'fp-ts'
import { useObservableEagerState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import {
  ListedNodesRD,
  NodeListingRD,
  NodeWhitelistRequestsRD,
  OperatorFinderFeeVaultRD,
  OperatorWhitelistRequests,
  OperatorWhitelistRequestsRD,
  ProviderWhitelistRequests,
  ProviderWhitelistRequestsRD,
  SentWhitelistRequest,
  listedNodes$,
  nodeListing$,
  providerWhitelistRequests$,
  reloadProviderRequests,
  sentWhitelistRequests$,
  nodeWhitelistRequests$,
  operatorFinderFeeVault$,
  operatorWhitelistRequests$
} from '../services/runebond'
import { useLastSuccessRD } from './useLastSuccess'

const NO_LISTING$ = Rx.of<NodeListingRD>(RD.initial)
const NO_NODE_WHITELIST_REQUESTS$ = Rx.of<NodeWhitelistRequestsRD>(RD.initial)
const NO_OPERATOR_WHITELIST_REQUESTS$ = Rx.of<OperatorWhitelistRequestsRD>(RD.initial)
const NO_FINDER_FEE_VAULT$ = Rx.of<OperatorFinderFeeVaultRD>(RD.initial)
const NO_PROVIDER_WHITELIST_REQUESTS$ = Rx.of<ProviderWhitelistRequestsRD>(RD.initial)
const NO_FINDER_FEE_VAULTS$ = Rx.of<OperatorFinderFeeVaultEntry[]>([])

export type OperatorFinderFeeVaultEntry = {
  address: Address
  vaultRD: OperatorFinderFeeVaultRD
}

const mergeRequestPages = (all: ProviderWhitelistRequests[]): ProviderWhitelistRequests => ({
  address: all.map(({ address }) => address).join(','),
  counts: all.reduce(
    (acc, { counts }) => ({
      pending: acc.pending + counts.pending,
      approved: acc.approved + counts.approved,
      bonded: acc.bonded + counts.bonded,
      rejected: acc.rejected + counts.rejected
    }),
    { pending: 0, approved: 0, bonded: 0, rejected: 0 }
  ),
  requests: all
    .flatMap(({ requests }) => requests)
    .sort((a, b) => b.height - a.height || b.requestedDate.getTime() - a.requestedDate.getTime()),
  total: all.reduce((acc, { total }) => acc + total, 0)
})

const mergeOperatorWhitelistRequests = (all: OperatorWhitelistRequests[]): OperatorWhitelistRequests =>
  all.length === 1 ? all[0] : { ...mergeRequestPages(all), nodes: all.flatMap(({ nodes }) => nodes) }

const mergeProviderWhitelistRequests = (all: ProviderWhitelistRequests[]): ProviderWhitelistRequests =>
  all.length === 1 ? all[0] : mergeRequestPages(all)

const SENT_POLL_INTERVAL_MS = 30_000

export type MyWhitelistRequestStatus = 'sent' | 'pending'

export type MyWhitelistRequest = {
  nodeAddress: Address
  providerAddress: Address
  intendedBond: BaseAmount
  status: MyWhitelistRequestStatus
  date: Date
  expiresDate: Date | null
}

const isSentIndexed = (sent: SentWhitelistRequest, indexed: ProviderWhitelistRequests): boolean =>
  indexed.requests.some(({ txId }) => txId.toUpperCase() === sent.txHash.toUpperCase())

export const useListedNodes = (): ListedNodesRD => useObservableEagerState(listedNodes$)

export const useProviderWhitelistRequests = (addresses: Address[]): ProviderWhitelistRequestsRD => {
  const key = Array.from(new Set(addresses.map((address) => address.toLowerCase())))
    .sort()
    .join('|')
  const requests$ = useMemo(() => {
    const unique = key === '' ? [] : key.split('|')
    if (unique.length === 0) return NO_PROVIDER_WHITELIST_REQUESTS$
    return Rx.combineLatest(unique.map(providerWhitelistRequests$)).pipe(
      RxOp.map((all) => RD.map(mergeProviderWhitelistRequests)(A.sequence(RD.remoteData)(all)))
    )
  }, [key])
  return useObservableEagerState(requests$)
}

export const useMyWhitelistRequests = (
  addresses: Address[]
): { requestsRD: ProviderWhitelistRequestsRD; myRequests: MyWhitelistRequest[]; loading: boolean } => {
  const liveRequestsRD = useProviderWhitelistRequests(addresses)
  const requestsRD = useLastSuccessRD(liveRequestsRD)
  const sent = useObservableEagerState(sentWhitelistRequests$)
  const ownKey = addresses.map((address) => address.toLowerCase()).join('|')
  const myRequests = useMemo(() => {
    const own = new Set(ownKey.split('|'))
    const indexed = RD.toNullable(requestsRD)
    const sentRows: MyWhitelistRequest[] = sent
      .filter((request) => own.has(request.providerAddress.toLowerCase()))
      .filter((request) => !indexed || !isSentIndexed(request, indexed))
      .map(({ nodeAddress, providerAddress, intendedBond, sentDate }) => ({
        nodeAddress,
        providerAddress,
        intendedBond,
        status: 'sent',
        date: sentDate,
        expiresDate: null
      }))
    const sentTargets = new Set(sentRows.map(({ nodeAddress, providerAddress }) => `${nodeAddress}|${providerAddress}`))
    const pendingRows: MyWhitelistRequest[] = (indexed?.requests ?? [])
      .filter(({ status }) => status === 'pending')
      .filter(({ nodeAddress, providerAddress }) => !sentTargets.has(`${nodeAddress}|${providerAddress}`))
      .map(({ nodeAddress, providerAddress, intendedBond, requestedDate, expiresDate }) => ({
        nodeAddress,
        providerAddress,
        intendedBond,
        status: 'pending',
        date: requestedDate,
        expiresDate
      }))
    return [...sentRows, ...pendingRows].sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [ownKey, requestsRD, sent])
  const hasSent = myRequests.some(({ status }) => status === 'sent')
  useEffect(() => {
    if (!hasSent) return
    const timer = window.setInterval(reloadProviderRequests, SENT_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [hasSent])

  return { requestsRD, myRequests, loading: RD.isPending(liveRequestsRD) }
}

export const useNodeListing = (nodeAddress: Address | undefined): NodeListingRD =>
  useObservableEagerState(useMemo(() => (nodeAddress ? nodeListing$(nodeAddress) : NO_LISTING$), [nodeAddress]))

export const useNodeWhitelistRequests = (nodeAddress: Address | undefined): NodeWhitelistRequestsRD =>
  useObservableEagerState(
    useMemo(() => (nodeAddress ? nodeWhitelistRequests$(nodeAddress) : NO_NODE_WHITELIST_REQUESTS$), [nodeAddress])
  )

export const useOperatorWhitelistRequests = (addresses: Address[]): OperatorWhitelistRequestsRD => {
  const key = Array.from(new Set(addresses)).sort().join('|')
  const requests$ = useMemo(() => {
    const unique = key === '' ? [] : key.split('|')
    if (unique.length === 0) return NO_OPERATOR_WHITELIST_REQUESTS$
    return Rx.combineLatest(unique.map(operatorWhitelistRequests$)).pipe(
      RxOp.map((all) => RD.map(mergeOperatorWhitelistRequests)(A.sequence(RD.remoteData)(all)))
    )
  }, [key])
  return useObservableEagerState(requests$)
}

export const useOperatorFinderFeeVault = (address: Address | undefined): OperatorFinderFeeVaultRD =>
  useObservableEagerState(useMemo(() => (address ? operatorFinderFeeVault$(address) : NO_FINDER_FEE_VAULT$), [address]))

export const useOperatorFinderFeeVaults = (addresses: Address[]): OperatorFinderFeeVaultEntry[] => {
  const key = Array.from(new Set(addresses)).sort().join('|')
  const vaults$ = useMemo(() => {
    const unique = key === '' ? [] : key.split('|')
    if (unique.length === 0) return NO_FINDER_FEE_VAULTS$
    return Rx.combineLatest(
      unique.map((address) =>
        operatorFinderFeeVault$(address).pipe(
          RxOp.map((vaultRD): OperatorFinderFeeVaultEntry => ({ address, vaultRD }))
        )
      )
    )
  }, [key])
  return useObservableEagerState(vaults$)
}
