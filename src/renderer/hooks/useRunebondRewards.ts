import { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'

import {
  NodeHistoryRD,
  NodeProviderRewardsRD,
  ProviderRewardsRD,
  nodeHistory$,
  nodeProviderRewards$,
  providerRewards$
} from '../services/runebond'

const currentValue = <T>(observable: Rx.Observable<RD.RemoteData<Error, T>>): RD.RemoteData<Error, T> => {
  let value: RD.RemoteData<Error, T> = RD.initial
  const subscription = observable.subscribe((next) => {
    value = next
  })
  subscription.unsubscribe()
  return value
}

const useLiveData = <T>(observable: Rx.Observable<RD.RemoteData<Error, T>>): RD.RemoteData<Error, T> => {
  const [state, setState] = useState<RD.RemoteData<Error, T>>(() => currentValue(observable))

  useEffect(() => {
    const subscription = observable.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [observable])

  return state
}

const NO_HISTORY$ = Rx.of<NodeHistoryRD>(RD.initial)

export const useProviderRewards = (addresses: Address[]): ProviderRewardsRD =>
  useLiveData(useMemo(() => providerRewards$(addresses), [addresses]))

export const useNodeProviderRewards = (addresses: Address[]): NodeProviderRewardsRD =>
  useLiveData(useMemo(() => nodeProviderRewards$(addresses), [addresses]))

export const useNodeHistory = (nodeAddress: Address | undefined, addresses: Address[]): NodeHistoryRD =>
  useLiveData(
    useMemo(() => (nodeAddress ? nodeHistory$(nodeAddress, addresses) : NO_HISTORY$), [addresses, nodeAddress])
  )
