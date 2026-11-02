import { createIntl } from 'react-intl'
import { describe, expect, it } from 'vitest'

import { MAYAChain, THORChain } from '../../../shared/utils/chainIds'
import thorMimir from '../../hooks/__fixtures__/thornode-mainnet-chains-halted-lp-paused/mimir.json'
import { getThorchainMimirHalt } from '../../hooks/useMimirHalt'
import enMessages from '../../i18n/en'
import { MimirHalt } from '../../services/thorchain/types'
import { buildPerProtocolMessages, getHaltPageContext, PageContext } from './AppHaltedChains'
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
})
