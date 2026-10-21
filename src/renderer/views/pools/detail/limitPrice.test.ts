import { describe, expect, it } from 'vitest'

import {
  chartLevelPrice,
  formatLimitInput,
  levelPriceOnChart,
  limitTriggerUsd,
  limitVsMarket,
  priceRangeWithLevels
} from './limitPrice'

describe('limitTriggerUsd', () => {
  it('stores the pool price when the typed dollar price is the chart close', () => {
    // Binance close is 3000 and the pool is 2940. A click on the close fills at the pool.
    expect(limitTriggerUsd(3000, 2940, 3000)).toBe(2940)
  })

  it('keeps the same distance from the pool that the typed price has from the chart', () => {
    // 10% under a 3000 chart close is 10% under a 2940 pool.
    expect(limitTriggerUsd(2700, 2940, 3000)).toBeCloseTo(2646)
    // Chart shows 4 counter per base, pool is $100. A click at 2 is half, so $50.
    expect(limitTriggerUsd(2, 100, 4)).toBe(50)
  })

  it('rejects a non-positive price or a missing scale', () => {
    expect(limitTriggerUsd(0, 100, 2)).toBeNull()
    expect(limitTriggerUsd(Number.NaN, 100, 2)).toBeNull()
    expect(limitTriggerUsd(2, 0, 4)).toBeNull()
    expect(limitTriggerUsd(2, 100, 0)).toBeNull()
    expect(limitTriggerUsd(2, Number.NaN, 4)).toBeNull()
  })
})

describe('levelPriceOnChart', () => {
  it('puts a pool trigger back on the chart where it was entered', () => {
    expect(levelPriceOnChart(2940, 2940, 3000)).toBe(3000)
    expect(levelPriceOnChart(2646, 2940, 3000)).toBeCloseTo(2700)
    expect(levelPriceOnChart(50, 100, 4)).toBe(2)
    expect(limitTriggerUsd(levelPriceOnChart(50, 100, 4) ?? 0, 100, 4)).toBe(50)
  })

  it('draws nothing until both scales are known', () => {
    expect(levelPriceOnChart(50, 0, 4)).toBeNull()
    expect(levelPriceOnChart(50, 100, 0)).toBeNull()
    expect(levelPriceOnChart(0, 100, 4)).toBeNull()
  })
})

describe('chartLevelPrice', () => {
  it('draws a pair level on the entered ratio', () => {
    expect(
      chartLevelPrice({ levelPrice: 0.025, unit: 'pair', chartUnit: 'pair', poolUsd: 2500, chartPrice: 0.024 })
    ).toBe(0.025)
  })

  it('turns a pair level into USD with the counter pool price', () => {
    expect(
      chartLevelPrice({
        levelPrice: 0.025,
        unit: 'pair',
        chartUnit: 'usd',
        poolUsd: 2500,
        chartPrice: 3000,
        counterUsd: 100000
      })
    ).toBe(2500)
  })

  it('omits a pair level on a USD chart until the counter price is known', () => {
    expect(
      chartLevelPrice({ levelPrice: 0.025, unit: 'pair', chartUnit: 'usd', poolUsd: 2500, chartPrice: 3000 })
    ).toBeNull()
  })

  it('keeps a USD level on the chart scale', () => {
    expect(chartLevelPrice({ levelPrice: 2940, chartUnit: 'usd', poolUsd: 2940, chartPrice: 3000 })).toBe(3000)
    expect(chartLevelPrice({ levelPrice: 50, unit: 'usd', chartUnit: 'pair', poolUsd: 100, chartPrice: 4 })).toBe(2)
  })
})

describe('priceRangeWithLevels', () => {
  it('leaves the candle range alone when every order is inside it', () => {
    const range = { minValue: 0.23, maxValue: 0.32 }
    expect(priceRangeWithLevels(range, [0.24, 0.3])).toBe(range)
  })

  it('expands the scale so an order below the candles stays visible', () => {
    const next = priceRangeWithLevels({ minValue: 0.23, maxValue: 0.32 }, [0.083])
    expect(next?.minValue).toBeLessThan(0.083)
    expect(next?.maxValue).toBeGreaterThan(0.32)
  })

  it('returns no range without candles', () => {
    expect(priceRangeWithLevels(null, [0.083])).toBeNull()
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
