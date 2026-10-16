import { describe, expect, it } from 'vitest'

import { chartPricePrecision, formatChartAmount, ratioCandles } from './pairChart'
import type { OHLCVCandle } from './types'

const candle = (time: number, open: number, high: number, low: number, close: number, volume = 1): OHLCVCandle => ({
  time,
  open,
  high,
  low,
  close,
  volume
})

describe('ratioCandles', () => {
  it('divides aligned candles into counter units per chart asset', () => {
    const base = [candle(10, 10, 12, 8, 11, 5)]
    const quote = [candle(10, 2, 4, 1, 2, 9)]
    expect(ratioCandles(base, quote)).toEqual([
      {
        time: 10,
        open: 5,
        close: 5.5,
        high: 12,
        low: 2,
        volume: 5
      }
    ])
  })

  it('skips a candle the quote series does not have', () => {
    const base = [candle(10, 2, 2, 2, 2), candle(20, 4, 4, 4, 4)]
    const quote = [candle(20, 2, 2, 2, 2)]
    expect(ratioCandles(base, quote)).toEqual([candle(20, 2, 2, 2, 2, 1)])
  })

  it('skips a candle whose quote price is zero', () => {
    const base = [candle(10, 2, 3, 1, 2)]
    const quote = [candle(10, 0, 1, 0, 1)]
    expect(ratioCandles(base, quote)).toEqual([])
  })
})

describe('chartPricePrecision', () => {
  it('uses fewer digits as the price gets larger', () => {
    expect(chartPricePrecision(0)).toBe(4)
    expect(chartPricePrecision(0.0078)).toBe(8)
    expect(chartPricePrecision(0.64)).toBe(6)
    expect(chartPricePrecision(80)).toBe(4)
    expect(chartPricePrecision(64000)).toBe(2)
  })
})

describe('formatChartAmount', () => {
  it('quotes the price in the counter ticker', () => {
    expect(formatChartAmount(0.007812, 'LTC')).toBe('0.007812 LTC')
  })
})
