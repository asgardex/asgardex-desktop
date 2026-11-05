// End to end: useThorchainMimirHalt (with holdLastKnown) -> HaltedChainsWarning banner.
// The "halt status unknown" banner must show not only for a failed request, but also when the
// status is unknown because a first load stays pending or the last value went stale.
import { act, createElement } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { createRoot } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { MemoryRouter } from 'react-router-dom'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAYAChain, THORChain } from '../../../shared/utils/chainIds'
import { useThorchainMimirHalt } from '../../hooks/useMimirHalt'
import en from '../../i18n/en/halt'
import { MimirHalt } from '../../services/thorchain/types'
import HaltedChainsWarning from './AppHaltedChains'

const mockThorchainContext = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../../contexts/ThorchainContext', () => ({
  useThorchainContext: () => mockThorchainContext.value
}))
vi.mock('../../services/storage/userChains', () => ({ userChains$: Rx.of(['BTC', 'THOR']) }))

const SECOND = 1000
const MINUTE = 60 * SECOND
const BANNER = 'Halt status of THOR could not be loaded'

const knownMaya = {
  protocol: MAYAChain,
  haltedChainsRD: RD.success([]),
  mimirHaltRD: RD.success({
    HALTMAYACHAIN: false,
    haltGlobalTrading: false,
    pauseGlobalLp: false
  } as unknown as MimirHalt),
  midgardStatusRD: RD.success(true)
}

const Probe = () => {
  const { mimirHaltRD } = useThorchainMimirHalt()
  return createElement(HaltedChainsWarning, {
    protocols: [
      { protocol: THORChain, haltedChainsRD: RD.success([]), mimirHaltRD, midgardStatusRD: RD.success(true) },
      knownMaya
    ]
  })
}

describe('views/app/AppHaltedChains + useThorchainMimirHalt: unknown banner for pending / stale / failure', () => {
  let mimir$: Rx.BehaviorSubject<RD.RemoteData<Error, Record<string, number>>>
  let lastblock$: Rx.BehaviorSubject<RD.RemoteData<Error, Array<{ chain: string; thorchain: number }>>>
  let container: HTMLDivElement
  let unmount: () => void

  const lastblock = (thorchain: number) => RD.success([{ chain: 'BTC', thorchain }])
  const text = () => container.textContent ?? ''
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  // lastblock is polled every 60s; keep it fresh so only mimir decides
  const advanceWithFreshLastblock = (ms: number) => {
    for (let t = 0; t < ms; t += MINUTE) {
      advance(Math.min(MINUTE, ms - t))
      act(() => lastblock$.next(lastblock(100 + t / MINUTE)))
    }
  }

  const render = () => {
    container = document.createElement('div')
    const root = createRoot(container)
    act(() =>
      root.render(
        createElement(
          IntlProvider,
          { locale: 'en', messages: en },
          createElement(MemoryRouter, { initialEntries: ['/pools/swap'] }, createElement(Probe))
        )
      )
    )
    unmount = () => act(() => root.unmount())
    advance(300) // banner renders after 200ms
  }

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    mimir$ = new Rx.BehaviorSubject<RD.RemoteData<Error, Record<string, number>>>(RD.pending)
    lastblock$ = new Rx.BehaviorSubject<RD.RemoteData<Error, Array<{ chain: string; thorchain: number }>>>(
      lastblock(100)
    )
    mockThorchainContext.value = { mimir$, thorchainLastblockState$: lastblock$ }
  })
  afterEach(() => {
    unmount()
    vi.useRealTimers()
  })

  it('first load stays pending: no banner at first, banner after the 15s pending timeout', () => {
    render()
    expect(text()).not.toContain(BANNER)
    advance(10 * SECOND)
    expect(text()).not.toContain(BANNER)
    advance(10 * SECOND)
    expect(text()).toContain(BANNER)
  })

  it('success then pending (reload): the held value stays, no banner', () => {
    mimir$.next(RD.success({}))
    render()
    act(() => mimir$.next(RD.pending))
    advance(30 * SECOND)
    expect(text()).not.toContain(BANNER)
  })

  it('success then failure: 1-2 failed polls keep the value, the 3rd shows the banner', () => {
    mimir$.next(RD.success({}))
    render()
    act(() => mimir$.next(RD.failure(Error('down'))))
    advance(SECOND)
    expect(text()).not.toContain(BANNER)
    act(() => mimir$.next(RD.failure(Error('down again'))))
    advance(SECOND)
    expect(text()).not.toContain(BANNER)
    act(() => mimir$.next(RD.failure(Error('still down'))))
    advance(SECOND)
    expect(text()).toContain(BANNER)
  })

  it('success, then no refresh: the value goes stale after 15 min and the banner shows', () => {
    mimir$.next(RD.success({}))
    render()
    advanceWithFreshLastblock(14 * MINUTE)
    expect(text()).not.toContain(BANNER)
    advanceWithFreshLastblock(2 * MINUTE)
    expect(text()).toContain(BANNER)
  })

  it('stale lastblock (10 min without a new height) also shows the banner', () => {
    mimir$.next(RD.success({}))
    render()
    // mimir is refreshed, lastblock is not
    for (let i = 0; i < 11; i++) {
      advance(MINUTE)
      act(() => mimir$.next(RD.success({ TICK: i })))
    }
    expect(text()).toContain(BANNER)
  })

  it('recovers: a fresh success after the banner hides it again', () => {
    render()
    advance(20 * SECOND)
    expect(text()).toContain(BANNER)
    act(() => mimir$.next(RD.success({})))
    advance(SECOND)
    expect(text()).not.toContain(BANNER)
  })

  it('success, failure x3, then a pending reload: the banner stays, no flapping', () => {
    mimir$.next(RD.success({}))
    render()
    for (const msg of ['a', 'b', 'c']) {
      act(() => mimir$.next(RD.failure(Error(msg))))
      advance(SECOND)
    }
    expect(text()).toContain(BANNER)
    act(() => mimir$.next(RD.pending))
    for (let i = 0; i < 6; i++) {
      advance(5 * SECOND)
      expect(text()).toContain(BANNER)
    }
  })
})
