import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address } from '@xchainjs/xchain-util'
import { useObservableEagerState } from 'observable-hooks'
import * as Rx from 'rxjs'

import {
  NodeHistoryRD,
  NodeProviderRewardsRD,
  NodeProvidersRD,
  ProviderRewardsRD,
  nodeHistory$,
  nodeProviderRewards$,
  nodeProviders$,
  providerRewards$
} from '../services/runebond'

const NO_HISTORY$ = Rx.of<NodeHistoryRD>(RD.initial)
const NO_NODE_PROVIDERS$ = Rx.of<NodeProvidersRD>(RD.initial)

export const useProviderRewards = (addresses: Address[]): ProviderRewardsRD =>
  useObservableEagerState(useMemo(() => providerRewards$(addresses), [addresses]))

export const useNodeProviderRewards = (addresses: Address[]): NodeProviderRewardsRD =>
  useObservableEagerState(useMemo(() => nodeProviderRewards$(addresses), [addresses]))

export const useNodeHistory = (nodeAddress: Address | undefined, addresses: Address[]): NodeHistoryRD =>
  useObservableEagerState(
    useMemo(() => (nodeAddress ? nodeHistory$(nodeAddress, addresses) : NO_HISTORY$), [addresses, nodeAddress])
  )

export const useNodeProviders = (nodeAddress: Address | undefined): NodeProvidersRD =>
  useObservableEagerState(
    useMemo(() => (nodeAddress ? nodeProviders$(nodeAddress) : NO_NODE_PROVIDERS$), [nodeAddress])
  )
