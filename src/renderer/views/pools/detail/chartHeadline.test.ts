import { describe, expect, it } from 'vitest'

import { chartHeadline } from './chartHeadline'
import type { OHLCVCandle } from './types'

const candle = (open: number, close: number): OHLCVCandle => ({
  time: 0,
  open,
  high: Math.max(open, close),
  low: Math.min(open, close),
  close,
  volume: 0
})

describe('chartHeadline', () => {
  it('returns null for an empty series', () => {
    expect(chartHeadline([])).toBeNull()
  })

  it('uses the last close and the move from the first open', () => {
    expect(chartHeadline([candle(100, 90), candle(90, 110)])).toEqual({ last: 110, changePct: 10 })
  })

  it('reports a down move as a negative percent', () => {
    expect(chartHeadline([candle(200, 180)])).toEqual({ last: 180, changePct: -10 })
  })

  it('omits the percent when the first open is zero', () => {
    expect(chartHeadline([candle(0, 5)])).toEqual({ last: 5, changePct: null })
  })
})
