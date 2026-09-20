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

/** last value replayed synchronously by a cached stream, `initial` otherwise */
const currentValue = <T>(observable: Rx.Observable<RD.RemoteData<Error, T>>): RD.RemoteData<Error, T> => {
  let value: RD.RemoteData<Error, T> = RD.initial
  const subscription = observable.subscribe((next) => {
    value = next
  })
  subscription.unsubscribe()
  return value
}

const useLiveData = <T>(observable: Rx.Observable<RD.RemoteData<Error, T>>): RD.RemoteData<Error, T> => {
  // start from the replayed value so a remount renders the data right away
  const [state, setState] = useState<RD.RemoteData<Error, T>>(() => currentValue(observable))

  useEffect(() => {
    const subscription = observable.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [observable])

  return state
}

/**
 * Rewards paid to the connected wallet addresses (RUNEBond Integrators API).
 * Re-subscribes whenever the set of addresses changes.
 */
export const useProviderRewards = (addresses: Address[]): ProviderRewardsRD => {
  const key = addresses.join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rewards$ = useMemo(() => providerRewards$(addresses), [key])
  return useLiveData(rewards$)
}

export const useNodeProviderRewards = (addresses: Address[]): NodeProviderRewardsRD => {
  const key = addresses.join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rewards$ = useMemo(() => nodeProviderRewards$(addresses), [key])
  return useLiveData(rewards$)
}

export const useNodeHistory = (nodeAddress: Address | undefined, addresses: Address[]): NodeHistoryRD => {
  const key = `${nodeAddress ?? ''}|${addresses.join('|')}`
  const history$ = useMemo(
    () => (nodeAddress ? nodeHistory$(nodeAddress, addresses) : Rx.of<NodeHistoryRD>(RD.initial)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  )
  return useLiveData(history$)
}
