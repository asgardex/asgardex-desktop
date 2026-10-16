import { describe, expect, it } from 'vitest'

import { formatLimitInput, limitTriggerUsd, limitVsMarket } from './limitPrice'

describe('limitTriggerUsd', () => {
  it('stores a dollar chart click as the USD trigger', () => {
    expect(limitTriggerUsd(123.45, 'usd', 100, 2)).toBe(123.45)
  })

  it('rejects a non-positive dollar price', () => {
    expect(limitTriggerUsd(0, 'usd', 100, 2)).toBeNull()
    expect(limitTriggerUsd(Number.NaN, 'usd', 100, 2)).toBeNull()
  })

  it('scales a pair click by the live ratio and the pool USD price', () => {
    // Chart shows 4 counter per base, pool is $100. A click at 2 is half, so $50.
    expect(limitTriggerUsd(2, 'pair', 100, 4)).toBe(50)
  })

  it('rejects a pair click when the pool or chart price is missing', () => {
    expect(limitTriggerUsd(2, 'pair', 0, 4)).toBeNull()
    expect(limitTriggerUsd(2, 'pair', 100, 0)).toBeNull()
    expect(limitTriggerUsd(2, 'pair', Number.NaN, 4)).toBeNull()
  })
})

describe('limitVsMarket', () => {
  it('treats a sell at or below the market as immediate', () => {
    expect(limitVsMarket('sell', 0.028275, 0.029691)).toMatchObject({ immediate: true })
    expect(limitVsMarket('sell', 0.029691, 0.029691)?.immediate).toBe(true)
  })

  it('lets a sell above the market wait', () => {
    expect(limitVsMarket('sell', 0.031, 0.029691)?.immediate).toBe(false)
  })

  it('treats a buy at or above the market as immediate', () => {
    expect(limitVsMarket('buy', 0.031, 0.029691)?.immediate).toBe(true)
    expect(limitVsMarket('buy', 0.028275, 0.029691)?.immediate).toBe(false)
  })

  it('reports how far the limit sits from the market', () => {
    const vs = limitVsMarket('sell', 90, 100)
    expect(vs?.percentFromMarket).toBeCloseTo(-10)
  })

  it('returns null without two positive prices', () => {
    expect(limitVsMarket('sell', 0, 1)).toBeNull()
    expect(limitVsMarket('buy', 1, 0)).toBeNull()
    expect(limitVsMarket('sell', Number.NaN, 1)).toBeNull()
  })
})

describe('formatLimitInput', () => {
  it('keeps significant decimals and drops trailing zeros', () => {
    expect(formatLimitInput(100)).toBe('100')
    expect(formatLimitInput(1.25)).toBe('1.25')
    expect(formatLimitInput(0.0012)).toBe('0.0012')
  })

  it('returns an empty field for a non-positive price', () => {
    expect(formatLimitInput(0)).toBe('')
    expect(formatLimitInput(Number.NaN)).toBe('')
  })
})
