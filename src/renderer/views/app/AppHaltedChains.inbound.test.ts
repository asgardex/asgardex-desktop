// inbound_addresses (halted chains) through the same hold/timeout helper as mimir (INBOUND_HOLD,
// applied in the Midgard pools services) -> HaltedChainsWarning: a first load that stays pending is unknown.
import { act, createElement, useMemo } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import { createRoot } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { MemoryRouter } from 'react-router-dom'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAYAChain, THORChain } from '../../../shared/utils/chainIds'
import { holdLastKnown } from '../../helpers/rx/holdLastKnown'
import en from '../../i18n/en/halt'
import { INBOUND_HOLD } from '../../services/haltStatusHold'
import { MimirHalt } from '../../services/thorchain/types'
import HaltedChainsWarning, { HaltedProtocol } from './AppHaltedChains'

const SECOND = 1000
const BANNER = 'Halt status of THOR could not be loaded'

const knownMimir = { HALTTHORCHAIN: false, haltGlobalTrading: false, pauseGlobalLp: false } as MimirHalt
const knownMaya: HaltedProtocol = {
  protocol: MAYAChain,
  haltedChainsRD: RD.success([]),
  mimirHaltRD: RD.success(knownMimir),
  midgardStatusRD: RD.success(true)
}

describe('views/app/AppHaltedChains: inbound_addresses pending timeout', () => {
  let inbound$: Rx.BehaviorSubject<RD.RemoteData<Error, Chain[]>>
  let container: HTMLDivElement
  let unmount: () => void

  const Probe = () => {
    const halted$ = useMemo(() => inbound$.pipe(holdLastKnown<Chain[]>(INBOUND_HOLD)), [])
    const haltedChainsRD = useObservableState(halted$, RD.initial)
    return createElement(HaltedChainsWarning, {
      protocols: [
        { protocol: THORChain, haltedChainsRD, mimirHaltRD: RD.success(knownMimir), midgardStatusRD: RD.success(true) },
        knownMaya
      ]
    })
  }

  const text = () => container.textContent ?? ''
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms)
    })

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
  }

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    inbound$ = new Rx.BehaviorSubject<RD.RemoteData<Error, Chain[]>>(RD.pending)
  })
  afterEach(() => {
    unmount()
    vi.useRealTimers()
  })

  it('first load pending: no banner at 10s, banner by 20s', () => {
    render()
    advance(10 * SECOND)
    expect(text()).not.toContain(BANNER)
    advance(10 * SECOND)
    expect(text()).toContain(BANNER)
  })

  it('recovers when inbound_addresses loads', () => {
    render()
    advance(20 * SECOND)
    expect(text()).toContain(BANNER)
    act(() => inbound$.next(RD.success([])))
    advance(SECOND)
    expect(text()).not.toContain(BANNER)
  })

  it('a pending reload with a held value keeps quiet', () => {
    inbound$.next(RD.success([]))
    render()
    act(() => inbound$.next(RD.pending))
    advance(30 * SECOND)
    expect(text()).not.toContain(BANNER)
  })

  it('a failure is unknown right away (not hidden behind the held value)', () => {
    inbound$.next(RD.success([]))
    render()
    act(() => inbound$.next(RD.failure(Error('inbound down'))))
    advance(SECOND)
    expect(text()).toContain(BANNER)
  })
})
