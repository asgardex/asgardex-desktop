import { act, createElement } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { createRoot } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAYAChain, THORChain } from '../../../shared/utils/chainIds'
import en from '../../i18n/en/halt'
import { MimirHalt } from '../../services/thorchain/types'
import HaltedChainsWarning, { HaltedProtocol } from './AppHaltedChains'

const knownMimir = { HALTTHORCHAIN: false, haltGlobalTrading: false, pauseGlobalLp: false } as MimirHalt

const known = (protocol: string): HaltedProtocol => ({
  protocol,
  haltedChainsRD: RD.success([]),
  mimirHaltRD: RD.success(knownMimir),
  midgardStatusRD: RD.success(true)
})

describe('views/app/AppHaltedChains: halt status unknown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })
  afterEach(() => vi.useRealTimers())

  const render = (path: string, protocols: HaltedProtocol[]) => {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => {
      root.render(
        createElement(
          IntlProvider,
          { locale: 'en', messages: en },
          createElement(MemoryRouter, { initialEntries: [path] }, createElement(HaltedChainsWarning, { protocols }))
        )
      )
    })
    // the component waits 200ms before it renders
    act(() => {
      vi.advanceTimersByTime(300)
    })
    return { text: container.textContent ?? '', unmount: () => act(() => root.unmount()) }
  }

  const failedMimir = (protocol: string): HaltedProtocol => ({
    ...known(protocol),
    mimirHaltRD: RD.failure(Error('mimir down'))
  })

  it('shows a blocking message when the mimir request failed (not "no halt")', () => {
    const { text, unmount } = render('/pools/swap', [failedMimir(THORChain), known(MAYAChain)])
    expect(text).toContain('Halt status of THOR could not be loaded')
    expect(text).toContain('blocked')
    expect(text).not.toContain('MAYA could not be loaded')
    unmount()
  })

  it('shows it on every page, e.g. the wallet (RUNE send is blocked there)', () => {
    const { text, unmount } = render('/wallet/assets', [failedMimir(THORChain), known(MAYAChain)])
    expect(text).toContain('Halt status of THOR could not be loaded')
    unmount()
  })

  it('names both protocols when both fail', () => {
    const { text, unmount } = render('/pools', [failedMimir(THORChain), failedMimir(MAYAChain)])
    expect(text).toContain('Halt status of THOR and MAYA could not be loaded')
    unmount()
  })

  it('on a swap page it names the failed protocol if it serves the selected chains', () => {
    const { text, unmount } = render('/pools/swap/BTC.BTC/keystore/ETH.ETH/keystore', [
      failedMimir(MAYAChain),
      known(THORChain)
    ])
    expect(text).toContain('Halt status of MAYA could not be loaded')
    unmount()
  })

  it('RUNE send wording only when THORChain is unknown', () => {
    const thor = render('/pools/swap', [failedMimir(THORChain), known(MAYAChain)])
    expect(thor.text).toContain('RUNE sends are blocked')
    thor.unmount()
    const both = render('/pools', [failedMimir(THORChain), failedMimir(MAYAChain)])
    expect(both.text).toContain('RUNE sends are blocked')
    both.unmount()
  })

  it('MAYA-only unknown status: no RUNE send clause (RUNE sends read the THOR halt state only)', () => {
    const { text, unmount } = render('/wallet/assets', [known(THORChain), failedMimir(MAYAChain)])
    expect(text).toContain('Halt status of MAYA could not be loaded. Liquidity actions are blocked')
    expect(text).not.toContain('RUNE')
    unmount()
  })

  it('does not say swaps are blocked (an unknown status alone does not block swaps)', () => {
    ;[
      [failedMimir(THORChain), known(MAYAChain)],
      [known(THORChain), failedMimir(MAYAChain)],
      [failedMimir(THORChain), failedMimir(MAYAChain)]
    ].forEach((protocols) => {
      const { text, unmount } = render('/pools', protocols)
      expect(text).toContain('could not be loaded')
      expect(text).toContain('Liquidity actions')
      expect(text).toContain('Swaps remain available if a quote is returned')
      expect(text).not.toMatch(/Swaps[^.]*blocked/)
      unmount()
    })
  })

  it('does not hide a halt proven by mimir while the status is unknown (e.g. block height down)', () => {
    const failedWithConfirmed = (confirmed: Partial<MimirHalt>): HaltedProtocol => ({
      ...failedMimir(THORChain),
      confirmedMimirHalt: { ...knownMimir, ...confirmed, haltStatusUnknown: true } as MimirHalt
    })
    const trading = render('/pools/swap', [failedWithConfirmed({ haltGlobalTrading: true }), known(MAYAChain)])
    expect(trading.text).toContain('Halt status of THOR could not be loaded')
    expect(trading.text).toContain('Trading on THOR is halted temporarily')
    trading.unmount()

    const chain = render('/pools', [
      failedWithConfirmed({ HALTBTCCHAIN: true } as Partial<MimirHalt>),
      known(MAYAChain)
    ])
    expect(chain.text).toContain('Halt status of THOR could not be loaded')
    expect(chain.text).toMatch(/BTC chain on THOR has been halted/)
    chain.unmount()
  })

  it('without a confirmed halt, a failed status shows only the unknown message', () => {
    const { text, unmount } = render('/pools', [failedMimir(THORChain), known(MAYAChain)])
    expect(text).not.toContain('is halted temporarily')
    expect(text).not.toContain('has been halted')
    unmount()
  })

  it('shows nothing when everything loaded and nothing is halted', () => {
    const { text, unmount } = render('/pools/swap', [known(THORChain), known(MAYAChain)])
    expect(text).not.toContain('could not be loaded')
    unmount()
  })

  it('a pending reload keeps quiet (no flash of the message)', () => {
    const pending: HaltedProtocol = { ...known(THORChain), mimirHaltRD: RD.pending }
    const { text, unmount } = render('/pools/swap', [pending, known(MAYAChain)])
    expect(text).not.toContain('could not be loaded')
    unmount()
  })

  it('shows the banner when inbound_addresses failed (actions are blocked then too)', () => {
    const failedInbound: HaltedProtocol = { ...known(THORChain), haltedChainsRD: RD.failure(Error('inbound down')) }
    const { text, unmount } = render('/pools/swap', [failedInbound, known(MAYAChain)])
    expect(text).toContain('Halt status of THOR could not be loaded')
    unmount()
  })

  it('a pending inbound_addresses reload keeps quiet', () => {
    const pendingInbound: HaltedProtocol = { ...known(THORChain), haltedChainsRD: RD.pending }
    const { text, unmount } = render('/pools/swap', [pendingInbound, known(MAYAChain)])
    expect(text).not.toContain('could not be loaded')
    unmount()
  })
})
