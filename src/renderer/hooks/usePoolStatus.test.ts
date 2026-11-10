import { act, createElement } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, AssetType } from '@xchainjs/xchain-util'
import { createRoot } from 'react-dom/client'
import * as Rx from 'rxjs'
import { vi } from 'vitest'

import { MAYAChain, THORChain } from '../../shared/utils/chainIds'
import { PoolStatus } from '../helpers/poolStatusHelper'
import { usePoolStatus } from './usePoolStatus'

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
mocks.thor = {
  mimir$: thorMimir$,
  thorchainLastblockState$: Rx.of(RD.success([{ chain: 'BTC', thorchain: 1000 }]))
}
mocks.maya = {
  mimir$: Rx.of(RD.success({ HALTBTCTRADING: 1 })),
  mayachainLastblockState$: Rx.of(RD.success([{ chain: 'BTC', mayachain: 1000 }]))
}
mocks.midgard = {
  service: { pools: { haltedChains$: Rx.of(RD.success(['SOL'])), pausedLPChains$: Rx.of(RD.success([])) } }
}
mocks.midgardMaya = {
  service: { pools: { haltedChains$: Rx.of(RD.success([])), pausedLPChains$: Rx.of(RD.success([])) } }
}

const BTC: AnyAsset = { chain: 'BTC', symbol: 'BTC', ticker: 'BTC', type: AssetType.NATIVE }
const SOL: AnyAsset = { chain: 'SOL', symbol: 'SOL', ticker: 'SOL', type: AssetType.NATIVE }

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
  it('THORChain: no status while mimir is loading, status once it is loaded', () => {
    const { get, unmount } = renderStatus(THORChain)
    expect(get(BTC)).toBeUndefined()
    // `inbound_addresses` is loaded already
    expect(get(SOL)?.kind).toBe('chain')
    act(() => thorMimir$.next(RD.success({ 'PAUSELPDEPOSIT-BTC-BTC': 1, HALTSOLTRADING: 1 })))
    expect(get(BTC)?.kind).toBe('deposit')
    expect(get(SOL)?.kind).toBe('trading')
    unmount()
  })

  it('MAYAChain: reads MAYAChain data', () => {
    const { get, unmount } = renderStatus(MAYAChain)
    expect(get(BTC)?.kind).toBe('trading')
    expect(get(SOL)).toBeUndefined()
    unmount()
  })
})
