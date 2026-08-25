import { describe, expect, it } from 'vitest'

import { getHaltPageContext } from './AppHaltedChains'

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
