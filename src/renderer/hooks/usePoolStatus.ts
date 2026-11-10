import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, Chain } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { THORChain } from '../../shared/utils/chainIds'
import { useMayachainContext } from '../contexts/MayachainContext'
import { useMidgardContext } from '../contexts/MidgardContext'
import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { useThorchainContext } from '../contexts/ThorchainContext'
import { getPoolStatus, PoolStatus, PoolStatusParams } from '../helpers/poolStatusHelper'
import { useObservableLayoutState } from './useObservableLayoutState'

export type PoolStatusData = Omit<PoolStatusParams, 'asset' | 'protocol'>

export const EMPTY_POOL_STATUS_DATA: PoolStatusData = { mimir: {}, lastHeight: 0, haltedChains: [], pausedLpChains: [] }

const getOrElse = <T>(rd: RD.RemoteData<Error, T>, fallback: T): T => (RD.isSuccess(rd) ? rd.value : fallback)

/**
 * Status of pools of THORChain or MAYAChain (halted chain / trading, paused LP / deposits).
 * Data is read for all chains, not only for chains enabled by the user, since pool lists show pools of all chains.
 * While data is loading (or failed to load), no status is returned.
 */
export const usePoolStatus = (protocol: Chain): ((asset: AnyAsset) => PoolStatus | undefined) => {
  const isThor = protocol === THORChain
  const { mimir$: mimirThor$, thorchainLastblockState$ } = useThorchainContext()
  const { mimir$: mimirMaya$, mayachainLastblockState$ } = useMayachainContext()
  const {
    service: {
      pools: { haltedChains$: haltedChainsThor$, pausedLPChains$: pausedLpChainsThor$ }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: { haltedChains$: haltedChainsMaya$, pausedLPChains$: pausedLpChainsMaya$ }
    }
  } = useMidgardMayaContext()

  const data$ = useMemo((): Rx.Observable<PoolStatusData> => {
    const lastHeight$: Rx.Observable<number> = isThor
      ? thorchainLastblockState$.pipe(
          RxOp.map((rd) => getOrElse(rd, []).find(({ thorchain }) => thorchain > 0)?.thorchain ?? 0)
        )
      : mayachainLastblockState$.pipe(
          RxOp.map((rd) => getOrElse(rd, []).find(({ mayachain }) => mayachain > 0)?.mayachain ?? 0)
        )
    return Rx.combineLatest([
      (isThor ? mimirThor$ : mimirMaya$).pipe(RxOp.map((rd) => getOrElse(rd, {}))),
      lastHeight$,
      (isThor ? haltedChainsThor$ : haltedChainsMaya$).pipe(RxOp.map((rd) => getOrElse<Chain[]>(rd, []))),
      (isThor ? pausedLpChainsThor$ : pausedLpChainsMaya$).pipe(RxOp.map((rd) => getOrElse<Chain[]>(rd, [])))
    ]).pipe(
      RxOp.map(([mimir, lastHeight, haltedChains, pausedLpChains]) => ({
        mimir,
        lastHeight,
        haltedChains,
        pausedLpChains
      }))
    )
  }, [
    isThor,
    mimirThor$,
    mimirMaya$,
    thorchainLastblockState$,
    mayachainLastblockState$,
    haltedChainsThor$,
    haltedChainsMaya$,
    pausedLpChainsThor$,
    pausedLpChainsMaya$
  ])

  const data = useObservableLayoutState(data$, EMPTY_POOL_STATUS_DATA)

  return useCallback((asset: AnyAsset) => getPoolStatus({ asset, protocol, ...data }), [data, protocol])
}
