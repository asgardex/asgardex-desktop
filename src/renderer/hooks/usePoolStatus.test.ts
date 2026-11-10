import { act, createElement } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, AssetType } from '@xchainjs/xchain-util'
import { createRoot } from 'react-dom/client'
import * as Rx from 'rxjs'
import { vi } from 'vitest'

import { MAYAChain, THORChain } from '../../shared/utils/chainIds'
import { PoolStatus } from '../helpers/poolStatusHelper'
import { getPoolHaltSource, POOL_HALT_DATA_STALE_MS, usePoolStatus } from './usePoolStatus'

// Streams are created once (stable identity across renders), as the real contexts provide them.
const mocks = vi.hoisted(() => ({
  thor: {} as Record<string, unknown>,
  maya: {} as Record<string, unknown>,
  midgard: {} as Record<string, unknown>,
  midgardMaya: {} as Record<string, unknown>
}))
vi.mock('../contexts/ThorchainContext', () => ({ useThorchainContext: () => mocks.thor }))
vi.mock('../contexts/MayachainContext', () => ({ useMayachainContext: () => mocks.maya }))
vi.mock('../contexts/MidgardContext', () => ({ useMidgardContext: () => mocks.midgard }))
vi.mock('../contexts/MidgardMayaContext', () => ({ useMidgardMayaContext: () => mocks.midgardMaya }))

const thorMimir$ = new Rx.BehaviorSubject<RD.RemoteData<Error, Record<string, number>>>(RD.pending)
const thorHalted$ = new Rx.BehaviorSubject<RD.RemoteData<Error, string[]>>(RD.success(['SOL']))
mocks.thor = {
  mimir$: thorMimir$,
  thorchainLastblockState$: Rx.of(RD.success([{ chain: 'BTC', thorchain: 1000 }]))
}
mocks.maya = {
  mimir$: Rx.of(RD.success({ HALTBTCTRADING: 1 })),
  mayachainLastblockState$: Rx.of(RD.success([{ chain: 'BTC', mayachain: 1000 }]))
}
mocks.midgard = {
  service: { pools: { haltedChains$: thorHalted$, pausedLPChains$: Rx.of(RD.success([])) } }
}
mocks.midgardMaya = {
  service: { pools: { haltedChains$: Rx.of(RD.success([])), pausedLPChains$: Rx.of(RD.success([])) } }
}

const BTC: AnyAsset = { chain: 'BTC', symbol: 'BTC', ticker: 'BTC', type: AssetType.NATIVE }
const SOL: AnyAsset = { chain: 'SOL', symbol: 'SOL', ticker: 'SOL', type: AssetType.NATIVE }
const XRD: AnyAsset = { chain: 'XRD', symbol: 'XRD', ticker: 'XRD', type: AssetType.NATIVE }

const renderStatus = (protocol: string) => {
  let getStatus: ((asset: AnyAsset) => PoolStatus | undefined) | undefined
  const Probe = () => {
    getStatus = usePoolStatus(protocol)
    return null
  }
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(document.createElement('div'))
  act(() => root.render(createElement(Probe)))
  return { get: (asset: AnyAsset) => getStatus?.(asset), unmount: () => act(() => root.unmount()) }
}

describe('hooks/usePoolStatus', () => {
  describe('getPoolHaltSource', () => {
    const now = 1_000_000_000
    const ok = {
      mimir: { rd: RD.success({ HALTBTCCHAIN: 1 }), updatedAt: now },
      lastHeight: { rd: RD.success(1000), updatedAt: now },
      haltedChains: RD.success([]),
      pausedLpChains: RD.success([]),
      now
    }

    it('returns the source when everything is loaded and fresh', () => {
      expect(getPoolHaltSource(ok)).toEqual({
        mimir: { HALTBTCCHAIN: 1 },
        lastHeight: 1000,
        haltedChains: [],
        pausedLpChains: []
      })
    })

    it('unknown while mimir, last block or inbound data is loading', () => {
      expect(getPoolHaltSource({ ...ok, mimir: { rd: RD.pending, updatedAt: now } })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, mimir: { rd: RD.initial, updatedAt: now } })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, lastHeight: { rd: RD.pending, updatedAt: now } })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, haltedChains: RD.pending })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, pausedLpChains: RD.pending })).toBeUndefined()
    })

    it('unknown if any source failed', () => {
      const failure = RD.failure(Error('501'))
      expect(getPoolHaltSource({ ...ok, mimir: { rd: failure, updatedAt: now } })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, lastHeight: { rd: failure, updatedAt: now } })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, haltedChains: failure })).toBeUndefined()
    })

    it('unknown without a block height', () => {
      expect(getPoolHaltSource({ ...ok, lastHeight: { rd: RD.success(0), updatedAt: now } })).toBeUndefined()
    })

    it('unknown if mimir or last block is stale', () => {
      const old = now - POOL_HALT_DATA_STALE_MS - 1
      expect(
        getPoolHaltSource({ ...ok, mimir: { ...ok.mimir, updatedAt: now - POOL_HALT_DATA_STALE_MS } })
      ).toBeDefined()
      expect(getPoolHaltSource({ ...ok, mimir: { ...ok.mimir, updatedAt: old } })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, lastHeight: { ...ok.lastHeight, updatedAt: old } })).toBeUndefined()
    })
  })

  it('THORChain: unknown while mimir is loading, real status once loaded, unknown again on failure', () => {
    const { get, unmount } = renderStatus(THORChain)
    expect(get(BTC)).toEqual({ kind: 'unknown' })
    expect(get(SOL)).toEqual({ kind: 'unknown' })
    act(() => thorMimir$.next(RD.success({ 'PAUSELPDEPOSIT-BTC-BTC': 1, HALTSOLTRADING: 1, HALTXRDCHAIN: 1 })))
    expect(get(BTC)?.kind).toBe('deposit')
    // mimir wins over the inbound `halted` flag for the label
    expect(get(SOL)?.kind).toBe('trading')
    // MimirHalt is mapped for each pool chain, also chains that are not enabled by the user
    expect(get(XRD)?.kind).toBe('chain')
    act(() => thorHalted$.next(RD.failure(Error('inbound failed'))))
    expect(get(BTC)).toEqual({ kind: 'unknown' })
    act(() => thorHalted$.next(RD.success([])))
    act(() => thorMimir$.next(RD.failure(Error('501'))))
    expect(get(BTC)).toEqual({ kind: 'unknown' })
    unmount()
  })

  it('MAYAChain: reads MAYAChain data', () => {
    const { get, unmount } = renderStatus(MAYAChain)
    expect(get(BTC)?.kind).toBe('trading')
    expect(get(SOL)).toBeUndefined()
    unmount()
  })
})
