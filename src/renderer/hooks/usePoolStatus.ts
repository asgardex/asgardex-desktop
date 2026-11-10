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
import { getPoolStatus, PoolHaltData, PoolStatus } from '../helpers/poolStatusHelper'
import { getThorchainMimirHalt } from './useMimirHalt'
import { getMayachainMimirHalt } from './useMimirHaltMaya'
import { useObservableLayoutState } from './useObservableLayoutState'

/**
 * Halt data older than this is stale (mimir reloads every 5 min, last block every 60 s),
 * so a hung reload cannot keep an old "all operational" state forever.
 */
export const POOL_HALT_DATA_STALE_MS = 15 * 60 * 1000

export type PoolHaltSource = {
  mimir: Record<string, number>
  lastHeight: number
  haltedChains: Chain[]
  pausedLpChains: Chain[]
}

type Timed<T> = { rd: RD.RemoteData<Error, T>; updatedAt: number }

/**
 * Halt source data of a protocol, or `undefined` (= status unknown, fail closed) if mimir, last block
 * or inbound addresses are loading, failed, or mimir / last block have not been refreshed for `staleMs`.
 */
export const getPoolHaltSource = ({
  mimir,
  lastHeight,
  haltedChains,
  pausedLpChains,
  now,
  staleMs = POOL_HALT_DATA_STALE_MS
}: {
  mimir: Timed<Record<string, number>>
  lastHeight: Timed<number>
  haltedChains: RD.RemoteData<Error, Chain[]>
  pausedLpChains: RD.RemoteData<Error, Chain[]>
  now: number
  staleMs?: number
}): PoolHaltSource | undefined => {
  if (!RD.isSuccess(mimir.rd) || !RD.isSuccess(lastHeight.rd)) return undefined
  if (!RD.isSuccess(haltedChains) || !RD.isSuccess(pausedLpChains)) return undefined
  // Without a height, mimir values set as block height cannot be evaluated
  if (lastHeight.rd.value <= 0) return undefined
  if (now - mimir.updatedAt > staleMs || now - lastHeight.updatedAt > staleMs) return undefined
  return {
    mimir: mimir.rd.value,
    lastHeight: lastHeight.rd.value,
    haltedChains: haltedChains.value,
    pausedLpChains: pausedLpChains.value
  }
}

const withUpdatedAt = <T>(source$: Rx.Observable<RD.RemoteData<Error, T>>): Rx.Observable<Timed<T>> =>
  source$.pipe(RxOp.map((rd) => ({ rd, updatedAt: Date.now() })))

/**
 * Status of pools of THORChain or MAYAChain, based on the shared halt logic
 * (`getThorchainMimirHalt` / `getMayachainMimirHalt` + `poolHelper(Maya)`).
 * `MimirHalt` is mapped for the chain of each pool, not only for chains enabled by the user,
 * since pool lists show pools of all chains.
 * While halt data is loading, failed or stale, every pool has the `unknown` status (Swap and Add disabled).
 * TODO: use `haltStatusUnknown` and the shared halt flags of halt-fail-closed once that branch merges.
 */
export const usePoolStatus = (
  protocol: Chain,
  staleCheckIntervalMs = 30 * 1000
): ((asset: AnyAsset) => PoolStatus | undefined) => {
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

  const source$ = useMemo((): Rx.Observable<PoolHaltSource | undefined> => {
    const lastHeight$: Rx.Observable<RD.RemoteData<Error, number>> = isThor
      ? thorchainLastblockState$.pipe(
          RxOp.map(RD.map((items) => items.find(({ thorchain }) => thorchain > 0)?.thorchain ?? 0))
        )
      : mayachainLastblockState$.pipe(
          RxOp.map(RD.map((items) => items.find(({ mayachain }) => mayachain > 0)?.mayachain ?? 0))
        )
    const mimir$: Rx.Observable<RD.RemoteData<Error, Record<string, number>>> = isThor ? mimirThor$ : mimirMaya$
    return Rx.combineLatest([
      withUpdatedAt(mimir$),
      withUpdatedAt(lastHeight$),
      isThor ? haltedChainsThor$ : haltedChainsMaya$,
      isThor ? pausedLpChainsThor$ : pausedLpChainsMaya$,
      // re-checks staleness; first tick is synchronous so replayed data is not shown as unknown
      Rx.interval(staleCheckIntervalMs).pipe(RxOp.startWith(0))
    ]).pipe(
      RxOp.map(([mimir, lastHeight, haltedChains, pausedLpChains]) =>
        getPoolHaltSource({ mimir, lastHeight, haltedChains, pausedLpChains, now: Date.now() })
      ),
      RxOp.distinctUntilChanged()
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
    pausedLpChainsMaya$,
    staleCheckIntervalMs
  ])

  // Starts unknown: the first emission is synchronous for replayed streams
  const source = useObservableLayoutState(source$, undefined)

  // `MimirHalt` per pool chain, mapped once per chain and source
  const getHaltData = useMemo(() => {
    const cache = new Map<Chain, PoolHaltData>()
    return (chain: Chain): PoolHaltData | undefined => {
      if (!source) return undefined
      const cached = cache.get(chain)
      if (cached) return cached
      const { mimir, lastHeight, haltedChains, pausedLpChains } = source
      const data: PoolHaltData = isThor
        ? {
            protocol: THORChain,
            mimirHalt: getThorchainMimirHalt({ mimir, lastHeight, chains: [chain] }),
            haltedChains,
            pausedLpChains
          }
        : {
            protocol,
            mimirHalt: getMayachainMimirHalt({ mimir, lastHeight, chains: [chain] }),
            haltedChains,
            pausedLpChains
          }
      cache.set(chain, data)
      return data
    }
  }, [source, isThor, protocol])

  return useCallback((asset: AnyAsset) => getPoolStatus(asset, getHaltData(asset.chain)), [getHaltData])
}
