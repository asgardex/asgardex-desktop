import { describe, expect, it } from 'vitest'

import { calculateBollingerBands, calculateEMA, calculateSMA } from './indicatorHelper'

describe('calculateSMA', () => {
  it('returns all nulls when period > length', () => {
    expect(calculateSMA([1, 2, 3], 5)).toEqual([null, null, null])
  })

  it('returns all nulls for empty array', () => {
    expect(calculateSMA([], 3)).toEqual([])
  })

  it('returns all nulls for period <= 0', () => {
    expect(calculateSMA([1, 2, 3], 0)).toEqual([null, null, null])
  })

  it('computes SMA correctly for period=3', () => {
    const closes = [2, 4, 6, 8, 10]
    const result = calculateSMA(closes, 3)
    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
    expect(result[2]).toBeCloseTo(4) // (2+4+6)/3
    expect(result[3]).toBeCloseTo(6) // (4+6+8)/3
    expect(result[4]).toBeCloseTo(8) // (6+8+10)/3
  })

  it('computes SMA with period=1 (identity)', () => {
    const closes = [5, 10, 15]
    const result = calculateSMA(closes, 1)
    expect(result).toEqual([5, 10, 15])
  })
})

describe('calculateEMA', () => {
  it('returns all nulls when period > length', () => {
    expect(calculateEMA([1, 2], 5)).toEqual([null, null])
  })

  it('returns all nulls for empty array', () => {
    expect(calculateEMA([], 3)).toEqual([])
  })

  it('returns all nulls for period <= 0', () => {
    expect(calculateEMA([1, 2, 3], 0)).toEqual([null, null, null])
  })

  it('seeds EMA with SMA of first period values', () => {
    const closes = [2, 4, 6, 8, 10]
    const result = calculateEMA(closes, 3)
    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
    // First EMA = SMA(2,4,6) = 4
    expect(result[2]).toBeCloseTo(4)
  })

  it('computes subsequent EMA values correctly', () => {
    const closes = [2, 4, 6, 8, 10]
    const result = calculateEMA(closes, 3)
    // multiplier = 2/(3+1) = 0.5
    // EMA[2] = 4
    // EMA[3] = (8-4)*0.5 + 4 = 6
    expect(result[3]).toBeCloseTo(6)
    // EMA[4] = (10-6)*0.5 + 6 = 8
    expect(result[4]).toBeCloseTo(8)
  })
})

describe('calculateBollingerBands', () => {
  it('returns all nulls when period > length', () => {
    const result = calculateBollingerBands([1, 2], 5)
    expect(result.middle).toEqual([null, null])
    expect(result.upper).toEqual([null, null])
    expect(result.lower).toEqual([null, null])
  })

  it('returns empty arrays for empty input', () => {
    const result = calculateBollingerBands([], 3)
    expect(result.middle).toEqual([])
    expect(result.upper).toEqual([])
    expect(result.lower).toEqual([])
  })

  it('middle band equals SMA', () => {
    const closes = [2, 4, 6, 8, 10]
    const result = calculateBollingerBands(closes, 3)
    const sma = calculateSMA(closes, 3)
    expect(result.middle).toEqual(sma)
  })

  it('upper and lower bands are symmetric around middle', () => {
    const closes = [2, 4, 6, 8, 10]
    const result = calculateBollingerBands(closes, 3, 2)
    for (let i = 0; i < closes.length; i++) {
      const mid = result.middle[i]
      const up = result.upper[i]
      const low = result.lower[i]
      if (mid === null) {
        expect(up).toBeNull()
        expect(low).toBeNull()
      } else {
        // upper - middle should equal middle - lower
        expect(up! - mid).toBeCloseTo(mid - low!)
      }
    }
  })

  it('bands widen with constant values (stddev = 0)', () => {
    const closes = [5, 5, 5, 5, 5]
    const result = calculateBollingerBands(closes, 3, 2)
    // All same value → stddev = 0 → upper = middle = lower
    expect(result.middle[2]).toBeCloseTo(5)
    expect(result.upper[2]).toBeCloseTo(5)
    expect(result.lower[2]).toBeCloseTo(5)
  })
})
