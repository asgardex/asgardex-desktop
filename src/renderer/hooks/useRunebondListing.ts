import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address } from '@xchainjs/xchain-util'
import { array as A } from 'fp-ts'
import { useObservableEagerState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import {
  NodeListingRD,
  NodeWhitelistRequestsRD,
  OperatorFinderFeeVaultRD,
  OperatorWhitelistRequests,
  OperatorWhitelistRequestsRD,
  nodeListing$,
  nodeWhitelistRequests$,
  operatorFinderFeeVault$,
  operatorWhitelistRequests$
} from '../services/runebond'

const NO_LISTING$ = Rx.of<NodeListingRD>(RD.initial)
const NO_NODE_WHITELIST_REQUESTS$ = Rx.of<NodeWhitelistRequestsRD>(RD.initial)
const NO_OPERATOR_WHITELIST_REQUESTS$ = Rx.of<OperatorWhitelistRequestsRD>(RD.initial)
const NO_FINDER_FEE_VAULT$ = Rx.of<OperatorFinderFeeVaultRD>(RD.initial)
const NO_FINDER_FEE_VAULTS$ = Rx.of<OperatorFinderFeeVaultEntry[]>([])

export type OperatorFinderFeeVaultEntry = {
  address: Address
  vaultRD: OperatorFinderFeeVaultRD
}

const mergeOperatorWhitelistRequests = (all: OperatorWhitelistRequests[]): OperatorWhitelistRequests => {
  if (all.length === 1) return all[0]
  return {
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
    nodes: all.flatMap(({ nodes }) => nodes),
    requests: all
      .flatMap(({ requests }) => requests)
      .sort((a, b) => b.height - a.height || b.requestedDate.getTime() - a.requestedDate.getTime()),
    total: all.reduce((acc, { total }) => acc + total, 0)
  }
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
