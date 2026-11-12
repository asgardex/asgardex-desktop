import { act, createElement } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { createRoot } from 'react-dom/client'
import { createIntl, IntlProvider } from 'react-intl'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { MAYAChain, THORChain } from '../../../shared/utils/chainIds'
import thorMimir from '../../hooks/__fixtures__/thornode-mainnet-chains-halted-lp-paused/mimir.json'
import { getThorchainMimirHalt } from '../../hooks/useMimirHalt'
import enMessages from '../../i18n/en'
import haltMessages from '../../i18n/en/halt'
import midgardMessages from '../../i18n/en/midgard'
import { MimirHalt } from '../../services/thorchain/types'
import HaltedChainsWarning, {
  buildPerProtocolMessages,
  getHaltPageContext,
  HaltedProtocol,
  PageContext
} from './AppHaltedChains'
import { ResolvedProtocolData } from './AppHaltedChains.helpers'

describe('views/app/AppHaltedChains getHaltPageContext', () => {
  it('classifies /pools/swap as swap only — not a pool/LP page', () => {
    const ctx = getHaltPageContext('/pools/swap/BTC.BTC/keystore/ETH.ETH/keystore')
    expect(ctx.isSwapPage).toBe(true)
    expect(ctx.isPoolPage).toBe(false)
    expect(ctx.isDepositPage).toBe(false)
  })

  it('classifies bare /pools/swap as swap only', () => {
    const ctx = getHaltPageContext('/pools/swap')
    expect(ctx.isSwapPage).toBe(true)
    expect(ctx.isPoolPage).toBe(false)
    expect(ctx.isDepositPage).toBe(false)
  })

  it('classifies add-liquidity deposit routes as deposit only', () => {
    const ctx = getHaltPageContext('/pools/deposit/BTC.BTC/keystore/keystore')
    expect(ctx.isDepositPage).toBe(true)
    expect(ctx.isSwapPage).toBe(false)
    expect(ctx.isPoolPage).toBe(false)
    expect(ctx.selectedChains).toEqual(['BTC'])
  })

  it('classifies pool overview as pool page', () => {
    const ctx = getHaltPageContext('/pools')
    expect(ctx.isPoolPage).toBe(true)
    expect(ctx.isSwapPage).toBe(false)
    expect(ctx.isDepositPage).toBe(false)
  })

  it('classifies pool detail as neither pool overview nor swap', () => {
    const ctx = getHaltPageContext('/pools/detail/BTC.BTC')
    expect(ctx.isPoolPage).toBe(false)
    expect(ctx.isSwapPage).toBe(false)
    expect(ctx.isDepositPage).toBe(false)
  })
})

describe('views/app/AppHaltedChains buildPerProtocolMessages (LP banner)', () => {
  const intl = createIntl({ locale: 'en', messages: enMessages })
  const poolPage: PageContext = { isSwapPage: false, isPoolPage: true, isDepositPage: false }
  const baseMimir = { HALTTHORCHAIN: false, haltGlobalTrading: false, pauseGlobalLp: false } as MimirHalt
  const thor = (mimirHalt: Partial<MimirHalt>): ResolvedProtocolData => ({
    protocol: THORChain,
    inboundHaltedChains: [],
    midgard: true,
    mimirHalt: { ...baseMimir, ...mimirHalt } as MimirHalt
  })
  const pauseDeposits = (chains: string) =>
    intl.formatMessage({ id: 'halt.chain.pauseDeposits' }, { chains, protocol: 'THORChain' })
  const pause = (chains: string) => intl.formatMessage({ id: 'halt.chain.pause' }, { chains })
  const pauseAll = intl.formatMessage({ id: 'halt.chain.pauseall' })

  it('names BSC and GAIA when only their gas-pool deposits are paused (PAUSELPDEPOSIT-BSC-BNB / -GAIA-ATOM)', () => {
    const data = thor({ 'PAUSELPDEPOSIT-BSC-BNB': true, 'PAUSELPDEPOSIT-GAIA-ATOM': true })
    expect(buildPerProtocolMessages(data, poolPage, intl)).toEqual([pauseDeposits('GAIA, BSC')])
  })

  it('names the gas-pool deposit pauses from the live 1 Nov mimir, incl. BSC and GAIA', () => {
    const mimirHalt = getThorchainMimirHalt({ mimir: thorMimir, lastHeight: 28483475, chains: ['BSC', 'GAIA'] })
    const deposit: PageContext = { isSwapPage: false, isPoolPage: false, isDepositPage: true, selectedChains: ['BSC'] }
    expect(buildPerProtocolMessages(thor(mimirHalt), deposit, intl)).toEqual([pauseDeposits('BSC')])
    const gaia: PageContext = { ...deposit, selectedChains: ['GAIA'] }
    expect(buildPerProtocolMessages(thor(mimirHalt), gaia, intl)).toEqual([pauseDeposits('GAIA')])
  })

  it('does not repeat fully halted chains in the LP lines on the pool page (mimir fixture)', () => {
    const mimirHalt = getThorchainMimirHalt({
      mimir: thorMimir,
      lastHeight: 28483475,
      chains: Object.keys(DEFAULT_ENABLED_CHAINS)
    })
    const messages = buildPerProtocolMessages(thor(mimirHalt), poolPage, intl)
    expect(messages).toEqual([
      intl.formatMessage(
        { id: 'halt.chains' },
        { chains: 'BCH, BTC, GAIA, DOGE, ETH, LTC, BSC, ZEC, TRON', protocol: THORChain }
      ),
      pauseDeposits('AVAX')
    ])
  })

  it('drops a chain from the per-chain LP pause line when its chain is halted (pool page)', () => {
    const data = thor({ HALTETHCHAIN: true, PAUSELPETH: true, PAUSELPBSC: true })
    expect(buildPerProtocolMessages(data, poolPage, intl)).toEqual([
      intl.formatMessage({ id: 'halt.chain' }, { chain: 'ETH', dex: THORChain }),
      pause('BSC')
    ])
  })

  it('keeps the deposit-pause line unfiltered on the deposit page, where no chain-halt line is shown', () => {
    const deposit: PageContext = { isSwapPage: false, isPoolPage: false, isDepositPage: true, selectedChains: ['BSC'] }
    const data = thor({ HALTBSCCHAIN: true, 'PAUSELPDEPOSIT-BSC-BNB': true })
    expect(buildPerProtocolMessages(data, deposit, intl)).toEqual([pauseDeposits('BSC')])
  })

  it('shows the all-chains LP text when LP is paused globally (pauseGlobalLp)', () => {
    expect(buildPerProtocolMessages(thor({ pauseGlobalLp: true }), poolPage, intl)).toEqual([pauseAll])
  })

  it('does not show a THORChain global LP pause on a MAYA-only deposit page', () => {
    const dash: PageContext = { isSwapPage: false, isPoolPage: false, isDepositPage: true, selectedChains: ['DASH'] }
    expect(buildPerProtocolMessages(thor({ pauseGlobalLp: true }), dash, intl)).toEqual([])
    const maya: ResolvedProtocolData = { ...thor({ pauseGlobalLp: true }), protocol: MAYAChain }
    expect(buildPerProtocolMessages(maya, dash, intl)).toEqual([pauseAll])
  })

  it('shows deposit-paused chains next to per-chain LP pauses, without repeating a chain', () => {
    const data = thor({
      PAUSELPETH: true,
      PAUSELPBSC: true,
      'PAUSELPDEPOSIT-BSC-BNB': true,
      'PAUSELPDEPOSIT-GAIA-ATOM': true
    })
    expect(buildPerProtocolMessages(data, poolPage, intl)).toEqual([pause('ETH, BSC'), pauseDeposits('GAIA')])
  })

  it('hides the other protocol when the pools overview has a protocol selected', () => {
    const thorHalted = thor({ HALTXRPCHAIN: true, pauseGlobalLp: true })
    const mayaHalted: ResolvedProtocolData = {
      ...thor({ HALTDASHCHAIN: true }),
      protocol: MAYAChain
    }
    const thorPage: PageContext = { ...poolPage, poolProtocol: THORChain }
    const mayaPage: PageContext = { ...poolPage, poolProtocol: MAYAChain }
    const chainflipPage: PageContext = { ...poolPage, poolProtocol: 'CHAINFLIP' }

    expect(buildPerProtocolMessages(thorHalted, thorPage, intl)).toEqual([
      intl.formatMessage({ id: 'halt.chain' }, { chain: 'XRP', dex: THORChain }),
      pauseAll
    ])
    expect(buildPerProtocolMessages(mayaHalted, thorPage, intl)).toEqual([])
    expect(buildPerProtocolMessages(thorHalted, mayaPage, intl)).toEqual([])
    expect(buildPerProtocolMessages(mayaHalted, mayaPage, intl)).toEqual([
      intl.formatMessage({ id: 'halt.chain' }, { chain: 'DASH', dex: MAYAChain })
    ])
    expect(buildPerProtocolMessages(thorHalted, chainflipPage, intl)).toEqual([])
    expect(buildPerProtocolMessages(mayaHalted, chainflipPage, intl)).toEqual([])
  })
})

describe('views/app/AppHaltedChains pools overview ticker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })
  afterEach(() => vi.useRealTimers())

  const baseMimir = { HALTTHORCHAIN: false, haltGlobalTrading: false, pauseGlobalLp: false } as MimirHalt
  const protocolData = (protocol: string, mimirHalt: Partial<MimirHalt>, midgard = true): HaltedProtocol => ({
    protocol,
    haltedChainsRD: RD.success([]),
    mimirHaltRD: RD.success({ ...baseMimir, ...mimirHalt } as MimirHalt),
    midgardStatusRD: midgard ? RD.success(true) : RD.success(false)
  })

  const render = (poolProtocol: string) => {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => {
      root.render(
        createElement(
          IntlProvider,
          { locale: 'en', messages: { ...haltMessages, ...midgardMessages } },
          createElement(
            MemoryRouter,
            { initialEntries: ['/pools'] },
            createElement(HaltedChainsWarning, {
              poolProtocol,
              protocols: [
                protocolData(THORChain, { haltGlobalTrading: true, HALTXRPCHAIN: true }, false),
                protocolData(MAYAChain, { HALTDASHCHAIN: true })
              ]
            })
          )
        )
      )
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    return {
      text: container.textContent ?? '',
      unmount: () => act(() => root.unmount())
    }
  }

  it('shows only the selected protocol, and neither THOR nor MAYA on Chainflip', () => {
    const maya = render(MAYAChain)
    expect(maya.text).toContain('DASH chain on MAYA has been halted temporarily')
    expect(maya.text).not.toContain('THOR')
    expect(maya.text).not.toContain('XRP')
    expect(maya.text).not.toContain('Midgard for THOR')
    maya.unmount()

    const thor = render(THORChain)
    expect(thor.text).toContain('Trading on THOR is halted temporarily')
    expect(thor.text).toContain('Midgard for THOR is offline')
    expect(thor.text).not.toContain('DASH')
    thor.unmount()

    const chainflip = render('CHAINFLIP')
    expect(chainflip.text).not.toContain('halted')
    expect(chainflip.text).not.toContain('Midgard')
    chainflip.unmount()
  })
})
