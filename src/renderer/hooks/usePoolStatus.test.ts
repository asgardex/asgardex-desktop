import { act, createElement } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, AssetType } from '@xchainjs/xchain-util'
import { createRoot } from 'react-dom/client'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, vi } from 'vitest'

import { MAYAChain, THORChain } from '../../shared/utils/chainIds'
import { PoolStatus } from '../helpers/poolStatusHelper'
import { getPoolHaltSource, usePoolStatus } from './usePoolStatus'

// Streams of the contexts, set per test. New subjects per test: the shared halt streams are memoized by
// their sources (`memoizeBySources`), so reusing subjects would carry the freshness state across tests.
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
// The shared halt status only has flags of the user's chains; pools must still map every pool chain
vi.mock('../services/storage/userChains', () => ({ userChains$: Rx.of(['BTC', 'THOR']) }))

const MINUTE = 60 * 1000

const BTC: AnyAsset = { chain: 'BTC', symbol: 'BTC', ticker: 'BTC', type: AssetType.NATIVE }
const SOL: AnyAsset = { chain: 'SOL', symbol: 'SOL', ticker: 'SOL', type: AssetType.NATIVE }
const XRD: AnyAsset = { chain: 'XRD', symbol: 'XRD', ticker: 'XRD', type: AssetType.NATIVE }

type MimirRD = RD.RemoteData<Error, Record<string, number>>
type LastblockRD = RD.RemoteData<Error, { chain: string; thorchain?: number; mayachain?: number }[]>

let thorMimir$: Rx.BehaviorSubject<MimirRD>
let thorLastblock$: Rx.BehaviorSubject<LastblockRD>
let thorHalted$: Rx.BehaviorSubject<RD.RemoteData<Error, string[]>>

beforeEach(() => {
  vi.useFakeTimers()
  thorMimir$ = new Rx.BehaviorSubject<MimirRD>(RD.pending)
  thorLastblock$ = new Rx.BehaviorSubject<LastblockRD>(RD.success([{ chain: 'BTC', thorchain: 1000 }]))
  thorHalted$ = new Rx.BehaviorSubject<RD.RemoteData<Error, string[]>>(RD.success(['SOL']))
  mocks.thor = { mimir$: thorMimir$, thorchainLastblockState$: thorLastblock$ }
  mocks.maya = {
    mimir$: new Rx.BehaviorSubject<MimirRD>(RD.success({ HALTBTCTRADING: 1 })),
    mayachainLastblockState$: new Rx.BehaviorSubject<LastblockRD>(RD.success([{ chain: 'BTC', mayachain: 1000 }]))
  }
  mocks.midgard = {
    service: { pools: { haltedChains$: thorHalted$, pausedLPChains$: new Rx.BehaviorSubject(RD.success([])) } }
  }
  mocks.midgardMaya = {
    service: {
      pools: {
        haltedChains$: new Rx.BehaviorSubject(RD.success([])),
        pausedLPChains$: new Rx.BehaviorSubject(RD.success([]))
      }
    }
  }
})

afterEach(() => {
  vi.useRealTimers()
})

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

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('hooks/usePoolStatus', () => {
  describe('getPoolHaltSource', () => {
    const ok = {
      haltStatus: RD.success({ haltStatusUnknown: false }),
      mimir: { HALTBTCCHAIN: 1 },
      lastHeight: 1000,
      haltedChains: RD.success([]),
      pausedLpChains: RD.success([])
    }

    it('returns the source when the shared halt status is known and inbound data is loaded', () => {
      expect(getPoolHaltSource(ok)).toEqual({
        mimir: { HALTBTCCHAIN: 1 },
        lastHeight: 1000,
        haltedChains: [],
        pausedLpChains: []
      })
    })

    it('unknown while the shared halt status is not loaded, failed or haltStatusUnknown', () => {
      expect(getPoolHaltSource({ ...ok, haltStatus: RD.initial })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, haltStatus: RD.pending })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, haltStatus: RD.failure(Error('stalled')) })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, haltStatus: RD.success({ haltStatusUnknown: true }) })).toBeUndefined()
    })

    it('unknown while inbound data is loading or failed', () => {
      expect(getPoolHaltSource({ ...ok, haltedChains: RD.pending })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, haltedChains: RD.failure(Error('inbound')) })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, pausedLpChains: RD.pending })).toBeUndefined()
    })

    it('unknown without raw mimir or a block height', () => {
      expect(getPoolHaltSource({ ...ok, mimir: undefined })).toBeUndefined()
      expect(getPoolHaltSource({ ...ok, lastHeight: 0 })).toBeUndefined()
    })
  })

  it('THORChain: unknown while mimir is loading, real status for every pool chain once loaded', () => {
    const { get, unmount } = renderStatus(THORChain)
    expect(get(BTC)).toEqual({ kind: 'unknown' })
    expect(get(SOL)).toEqual({ kind: 'unknown' })
    act(() => thorMimir$.next(RD.success({ 'PAUSELPDEPOSIT-BTC-BTC': 1, HALTSOLTRADING: 1, HALTXRDCHAIN: 1 })))
    expect(get(BTC)?.kind).toBe('deposit')
    // mimir wins over the inbound `halted` flag for the label
    expect(get(SOL)?.kind).toBe('trading')
    // MimirHalt is mapped for each pool chain, also chains that are not enabled by the user (only BTC, THOR)
    expect(get(XRD)?.kind).toBe('chain')
    unmount()
  })

  it('THORChain: unknown when inbound_addresses fails, known again once it loads', () => {
    thorMimir$.next(RD.success({}))
    const { get, unmount } = renderStatus(THORChain)
    expect(get(BTC)).toBeUndefined()
    act(() => thorHalted$.next(RD.failure(Error('inbound failed'))))
    expect(get(BTC)).toEqual({ kind: 'unknown' })
    act(() => thorHalted$.next(RD.success([])))
    expect(get(BTC)).toBeUndefined()
    unmount()
  })

  it('THORChain: follows the shared hold, 1-2 failed mimir polls keep the status, the 3rd makes it unknown', () => {
    thorMimir$.next(RD.success({ HALTSOLTRADING: 1 }))
    const { get, unmount } = renderStatus(THORChain)
    expect(get(SOL)?.kind).toBe('trading')
    act(() => thorMimir$.next(RD.failure(Error('501'))))
    act(() => thorMimir$.next(RD.failure(Error('501'))))
    expect(get(SOL)?.kind).toBe('trading')
    act(() => thorMimir$.next(RD.failure(Error('501'))))
    expect(get(SOL)).toEqual({ kind: 'unknown' })
    expect(get(BTC)).toEqual({ kind: 'unknown' })
    unmount()
  })

  it('THORChain: a block height that stopped advancing makes every pool unknown (shared stall check)', () => {
    thorMimir$.next(RD.success({}))
    const { get, unmount } = renderStatus(THORChain)
    expect(get(BTC)).toBeUndefined()
    // lastblock keeps answering with the same height (stuck node / cached response)
    advance(5 * MINUTE + 5000)
    expect(get(BTC)).toEqual({ kind: 'unknown' })
    // a new height makes it known again
    act(() => thorLastblock$.next(RD.success([{ chain: 'BTC', thorchain: 1100 }])))
    expect(get(BTC)).toBeUndefined()
    unmount()
  })

  it('THORChain: unknown without a THORChain block height', () => {
    thorMimir$.next(RD.success({}))
    thorLastblock$.next(RD.success([{ chain: 'BTC', thorchain: 0 }]))
    const { get, unmount } = renderStatus(THORChain)
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
