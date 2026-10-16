import { useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, Chain } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { MAYAChain } from '../../../../shared/utils/chainIds'
import { useMayachainContext } from '../../../contexts/MayachainContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import type { LoadActionsParams } from '../../../services/midgard/midgardTypes'
import { rowsForPair, type PairSwapAction, type PairSwapRow } from './pairSwaps'

export type PairSwapPhase = 'loading' | 'ready' | 'error'

type Loaded = { key: string; actions: PairSwapAction[] }

type Params = {
  protocol: Chain
  poolAsset: AnyAsset
  counter: AnyAsset | null
  addresses: string[]
  /** Bumped when a swap from this ticket settles, so the list refetches. */
  reloadToken: number
}

/**
 * Recent swaps for the chart pair, from the protocol's Midgard plus the in-flight tracker.
 * A refetch keeps the previous rows on screen.
 */
export const usePairSwaps = ({
  protocol,
  poolAsset,
  counter,
  addresses,
  reloadToken
}: Params): {
  rows: PairSwapRow[]
  phase: PairSwapPhase
} => {
  const {
    service: {
      actions: { getActions$: getThorActions$ }
    }
  } = useMidgardContext()
  const {
    service: {
      actions: { getActions$: getMayaActions$ }
    }
  } = useMidgardMayaContext()
  const { transactionTrackingService: thorTracking } = useThorchainContext()
  const { transactionTrackingService: mayaTracking } = useMayachainContext()

  const addressKey = addresses.join('\n')
  const scopeKey = `${protocol}:${addressKey}`
  const requestKey = `${scopeKey}:${reloadToken}`
  const cache = useRef<{ scopeKey: string; actions: PairSwapAction[] } | null>(null)

  const history$ = useMemo(() => {
    const key = requestKey
    const list = addressKey ? addressKey.split('\n') : []
    if (list.length === 0) return Rx.of(RD.pending)
    const load = protocol === MAYAChain ? getMayaActions$ : getThorActions$
    const base: LoadActionsParams = { page: 0, itemsPerPage: 40, addresses: list }
    return Rx.combineLatest([
      load({ ...base, type: 'SWAP' }),
      load({ ...base, itemsPerPage: 20, type: 'REFUND' })
    ]).pipe(
      RxOp.map(([swaps, refunds]): RD.RemoteData<Error, Loaded> => {
        if (RD.isInitial(swaps) || RD.isPending(swaps) || RD.isInitial(refunds) || RD.isPending(refunds)) {
          return RD.pending
        }
        if (RD.isFailure(swaps) && RD.isFailure(refunds)) return RD.failure(new Error('swaps'))
        const actions = [
          ...(RD.isSuccess(swaps) ? swaps.value.actions : []),
          ...(RD.isSuccess(refunds) ? refunds.value.actions : [])
        ]
        return RD.success({ key, actions })
      })
    )
  }, [requestKey, addressKey, protocol, getThorActions$, getMayaActions$])

  const historyRD = useObservableState(history$, RD.initial)
  const tracked$ = protocol === MAYAChain ? mayaTracking.getTransactions$ : thorTracking.getTransactions$
  const trackedRD = useObservableState(tracked$, RD.initial)

  const fresh = RD.isSuccess(historyRD) && historyRD.value.key === requestKey ? historyRD.value.actions : null
  if (fresh) cache.current = { scopeKey, actions: fresh }
  const actions = fresh ?? (cache.current?.scopeKey === scopeKey ? cache.current.actions : null)
  const tracked = useMemo(() => (RD.isSuccess(trackedRD) ? trackedRD.value : []), [trackedRD])

  const rows = useMemo(
    () => rowsForPair(actions ?? [], tracked, poolAsset, counter),
    [actions, tracked, poolAsset, counter]
  )

  const phase: PairSwapPhase = actions ? 'ready' : RD.isFailure(historyRD) ? 'error' : 'loading'
  return { rows, phase }
}
