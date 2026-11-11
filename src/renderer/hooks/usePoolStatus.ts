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
import { getSharedThorchainMimirHalt$, getThorchainMimirHalt } from './useMimirHalt'
import { getMayachainMimirHalt, getSharedMayachainMimirHalt$ } from './useMimirHaltMaya'
import { useObservableLayoutState } from './useObservableLayoutState'

type Mimir = Record<string, number>

export type PoolHaltSource = {
  mimir: Mimir
  lastHeight: number
  haltedChains: Chain[]
  pausedLpChains: Chain[]
}

/** `PoolHaltSource` tagged with the protocol it was built for */
type TaggedPoolHaltSource = PoolHaltSource & { protocol: Chain }

/**
 * Halt source data of a protocol, or `undefined` (= status unknown, fail closed).
 *
 * Whether the halt status is known comes from the shared halt hooks (`getSharedThorchainMimirHalt$` /
 * `getSharedMayachainMimirHalt$`, the streams behind `useThorchainMimirHalt` / `useMayachainMimirHalt`):
 * their `mimirHaltRD` is Success with `haltStatusUnknown: false` only while mimir and a fresh, advancing block
 * height are known (`holdLastKnown`, `failIfHeightStalled`, network reset). Pools reuse that one shared freshness
 * state instead of a local loading / stale check.
 * `inbound_addresses` (halted chains) and paused LP chains must be loaded, too (see `resolveHaltState`).
 *
 * `mimir` / `lastHeight` are the last loaded raw values, the ones the shared status was built from. They are only
 * used while the shared status is known, to map `MimirHalt` for each pool chain (the shared status only has flags
 * of the chains enabled by the user).
 */
export const getPoolHaltSource = ({
  haltStatus,
  mimir,
  lastHeight,
  haltedChains,
  pausedLpChains
}: {
  haltStatus: RD.RemoteData<Error, { haltStatusUnknown: boolean }>
  mimir: Mimir | undefined
  lastHeight: number
  haltedChains: RD.RemoteData<Error, Chain[]>
  pausedLpChains: RD.RemoteData<Error, Chain[]>
}): PoolHaltSource | undefined => {
  if (!RD.isSuccess(haltStatus) || haltStatus.value.haltStatusUnknown) return undefined
  if (!RD.isSuccess(haltedChains) || !RD.isSuccess(pausedLpChains)) return undefined
  // Without a height, mimir values set as block height cannot be evaluated
  if (!mimir || lastHeight <= 0) return undefined
  return { mimir, lastHeight, haltedChains: haltedChains.value, pausedLpChains: pausedLpChains.value }
}

/** Last loaded value of a stream (`undefined` until the first Success) */
const lastSuccess = <T>(source$: Rx.Observable<RD.RemoteData<Error, T>>): Rx.Observable<T | undefined> =>
  source$.pipe(
    RxOp.scan<RD.RemoteData<Error, T>, T | undefined>((last, rd) => (RD.isSuccess(rd) ? rd.value : last), undefined),
    RxOp.startWith<T | undefined>(undefined)
  )

/**
 * Status of pools of THORChain or MAYAChain, based on the shared halt logic
 * (`useMimirHalt` / `useMimirHaltMaya` + `poolHelper(Maya)`).
 * `MimirHalt` is mapped for the chain of each pool, not only for chains enabled by the user,
 * since pool lists show pools of all chains.
 * While the shared halt status is unknown (`haltStatusUnknown`: loading, failed, stale or stalled) or inbound data
 * is not loaded, every pool has the `unknown` status (Swap and Add disabled).
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

  const source$ = useMemo((): Rx.Observable<TaggedPoolHaltSource | undefined> => {
    // Same shared (memoized) streams as `useThorchainMimirHalt` / `useMayachainMimirHalt`
    const haltStatus$ = isThor
      ? getSharedThorchainMimirHalt$(mimirThor$, thorchainLastblockState$).mimirHaltRD$
      : getSharedMayachainMimirHalt$(mimirMaya$, mayachainLastblockState$).mimirHaltRD$
    const mimir$: Rx.Observable<RD.RemoteData<Error, Mimir>> = isThor ? mimirThor$ : mimirMaya$
    const lastHeight$: Rx.Observable<number> = isThor
      ? lastSuccess(thorchainLastblockState$).pipe(
          RxOp.map((items) => items?.find(({ thorchain }) => thorchain > 0)?.thorchain ?? 0)
        )
      : lastSuccess(mayachainLastblockState$).pipe(
          RxOp.map((items) => items?.find(({ mayachain }) => mayachain > 0)?.mayachain ?? 0)
        )
    return Rx.combineLatest([
      haltStatus$,
      lastSuccess(mimir$),
      lastHeight$,
      isThor ? haltedChainsThor$ : haltedChainsMaya$,
      isThor ? pausedLpChainsThor$ : pausedLpChainsMaya$
    ]).pipe(
      RxOp.map(([haltStatus, mimir, lastHeight, haltedChains, pausedLpChains]): TaggedPoolHaltSource | undefined => {
        const source = getPoolHaltSource({ haltStatus, mimir, lastHeight, haltedChains, pausedLpChains })
        return source ? { ...source, protocol } : undefined
      }),
      // `combineLatest` emits only once every input has emitted: start unknown, so a protocol switch never keeps
      // the previous protocol's status while the new protocol's streams have not emitted yet
      RxOp.startWith<TaggedPoolHaltSource | undefined>(undefined),
      RxOp.distinctUntilChanged()
    )
  }, [
    isThor,
    protocol,
    mimirThor$,
    mimirMaya$,
    thorchainLastblockState$,
    mayachainLastblockState$,
    haltedChainsThor$,
    haltedChainsMaya$,
    pausedLpChainsThor$,
    pausedLpChainsMaya$
  ])

  // Starts unknown: the first emission is synchronous for replayed streams
  const taggedSource = useObservableLayoutState(source$, undefined)
  // A source of another protocol (state of the previous `source$` before the layout effect resubscribed)
  // is never used: unknown until this protocol's source is there
  const source = taggedSource?.protocol === protocol ? taggedSource : undefined

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
