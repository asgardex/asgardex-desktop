import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address } from '@xchainjs/xchain-util'
import { useObservableEagerState } from 'observable-hooks'
import * as Rx from 'rxjs'

import {
  NodeHistoryRD,
  NodeProviderRewardsRD,
  ProviderRewardsRD,
  nodeHistory$,
  nodeProviderRewards$,
  providerRewards$
} from '../services/runebond'

const NO_HISTORY$ = Rx.of<NodeHistoryRD>(RD.initial)

export const useProviderRewards = (addresses: Address[]): ProviderRewardsRD =>
  useObservableEagerState(useMemo(() => providerRewards$(addresses), [addresses]))

export const useNodeProviderRewards = (addresses: Address[]): NodeProviderRewardsRD =>
  useObservableEagerState(useMemo(() => nodeProviderRewards$(addresses), [addresses]))

export const useNodeHistory = (nodeAddress: Address | undefined, addresses: Address[]): NodeHistoryRD =>
  useObservableEagerState(
    useMemo(() => (nodeAddress ? nodeHistory$(nodeAddress, addresses) : NO_HISTORY$), [addresses, nodeAddress])
  )
