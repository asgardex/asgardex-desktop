import type { DepthHistoryItem } from '@xchainjs/xchain-midgard'

import {
  getCount,
  getDepthInterval,
  getSwapInterval,
  thorDepthItemToCandle,
  mayaDepthItemToCandle,
  swapItemToVolume,
  mergeOHLCV,
  aggregateToFourHour
} from './chartHelper'

// Minimal DepthHistoryItem for testing
const makeThorDepthItem = (overrides: Partial<DepthHistoryItem> = {}): DepthHistoryItem => ({
  assetDepth: '1000000000',
  assetPrice: '10.0',
  assetPriceUSD: '5.0',
  endTime: '1700001000',
  liquidityUnits: '100',
  luvi: '1.0',
  membersCount: '10',
  runeDepth: '10000000000',
  startTime: '1700000000',
  synthSupply: '0',
  synthUnits: '0',
  units: '100',
  ...overrides
})

const makeSwapItem = (
  overrides: Partial<{ startTime: string; totalVolumeUSD: string }> = {}
): { startTime: string; totalVolumeUSD: string } => ({
  startTime: '1700000000',
  totalVolumeUSD: '100000', // e2 → $1000
  ...overrides
})

describe('chartHelper', () => {
  describe('getDepthInterval', () => {
    it('maps 1H to Hour', () => {
      expect(getDepthInterval('1H')).toBe('hour')
    })
    it('maps 4H to Hour', () => {
      expect(getDepthInterval('4H')).toBe('hour')
    })
    it('maps 1D to Day', () => {
      expect(getDepthInterval('1D')).toBe('day')
    })
    it('maps 1W to Week', () => {
      expect(getDepthInterval('1W')).toBe('week')
    })
  })

  describe('getSwapInterval', () => {
    it('maps 1H to Hour', () => {
      expect(getSwapInterval('1H')).toBe('hour')
    })
    it('maps 1D to Day', () => {
      expect(getSwapInterval('1D')).toBe('day')
    })
  })

  describe('getCount', () => {
    it('returns 7 for 7d/1D', () => {
      expect(getCount('7d', '1D')).toBe(7)
    })

    it('caps at 400 for 30d/1H', () => {
      // 30d = 720 hours, capped to 400
      expect(getCount('30d', '1H')).toBe(400)
    })

    it('caps at 400 for 30d/4H (fetches hourly)', () => {
      expect(getCount('30d', '4H')).toBe(400)
    })

    it('returns 30 for 30d/1D', () => {
      expect(getCount('30d', '1D')).toBe(30)
    })

    it('returns ~53 for 365d/1W', () => {
      expect(getCount('365d', '1W')).toBe(Math.ceil(365 / 7))
    })
  })

  describe('thorDepthItemToCandle', () => {
    it('extracts native OHLC fields', () => {
      const item = makeThorDepthItem({
        openPriceUSD: '10.0',
        highPriceUSD: '12.0',
        lowPriceUSD: '9.0',
        closePriceUSD: '11.0'
      })
      const candle = thorDepthItemToCandle(item)
      expect(candle).toEqual({
        time: 1700000000,
        open: 10.0,
        high: 12.0,
        low: 9.0,
        close: 11.0
      })
    })

    it('falls back to assetPriceUSD when OHLC fields missing', () => {
      const item = makeThorDepthItem() // no OHLC fields
      const candle = thorDepthItemToCandle(item)
      expect(candle).toEqual({
        time: 1700000000,
        open: 5.0,
        high: 5.0,
        low: 5.0,
        close: 5.0
      })
    })

    it('partially falls back when some OHLC fields present', () => {
      const item = makeThorDepthItem({ openPriceUSD: '6.0', closePriceUSD: '7.0' })
      const candle = thorDepthItemToCandle(item)
      expect(candle.open).toBe(6.0)
      expect(candle.close).toBe(7.0)
      expect(candle.high).toBe(5.0) // fallback
      expect(candle.low).toBe(5.0) // fallback
    })
  })

  describe('mayaDepthItemToCandle', () => {
    it('creates flat candle from assetPriceUSD', () => {
      const item = makeThorDepthItem({ assetPriceUSD: '3.5' })
      const candle = mayaDepthItemToCandle(item)
      expect(candle).toEqual({
        time: 1700000000,
        open: 3.5,
        high: 3.5,
        low: 3.5,
        close: 3.5
      })
    })
  })

  describe('swapItemToVolume', () => {
    it('extracts volume in USD (divides e2)', () => {
      const item = makeSwapItem({ totalVolumeUSD: '500000' })
      const result = swapItemToVolume(item)
      expect(result).toEqual({ time: 1700000000, volume: 5000 })
    })
  })

  describe('mergeOHLCV', () => {
    it('merges candles with volume by timestamp', () => {
      const candles = [
        { time: 100, open: 1, high: 2, low: 0.5, close: 1.5 },
        { time: 200, open: 1.5, high: 3, low: 1, close: 2 }
      ]
      const volumes = [
        { time: 100, volume: 1000 },
        { time: 200, volume: 2000 }
      ]
      const result = mergeOHLCV(candles, volumes)
      expect(result[0].volume).toBe(1000)
      expect(result[1].volume).toBe(2000)
    })

    it('defaults to 0 volume for unmatched candles', () => {
      const candles = [{ time: 100, open: 1, high: 2, low: 0.5, close: 1.5 }]
      const result = mergeOHLCV(candles, [])
      expect(result[0].volume).toBe(0)
    })
  })

  describe('aggregateToFourHour', () => {
    it('groups 4 hourly candles into 1 4H candle', () => {
      const hourly = [
        { time: 100, open: 10, high: 12, low: 9, close: 11, volume: 100 },
        { time: 200, open: 11, high: 15, low: 10, close: 14, volume: 200 },
        { time: 300, open: 14, high: 16, low: 13, close: 15, volume: 150 },
        { time: 400, open: 15, high: 17, low: 14, close: 16, volume: 250 }
      ]
      const result = aggregateToFourHour(hourly)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        time: 100,
        open: 10,
        high: 17,
        low: 9,
        close: 16,
        volume: 700
      })
    })

    it('handles partial last chunk', () => {
      const hourly = [
        { time: 100, open: 10, high: 12, low: 9, close: 11, volume: 100 },
        { time: 200, open: 11, high: 13, low: 10, close: 12, volume: 200 },
        { time: 300, open: 12, high: 14, low: 11, close: 13, volume: 300 },
        { time: 400, open: 13, high: 15, low: 12, close: 14, volume: 400 },
        { time: 500, open: 14, high: 16, low: 13, close: 15, volume: 500 }
      ]
      const result = aggregateToFourHour(hourly)
      expect(result).toHaveLength(2)
      expect(result[1]).toEqual({
        time: 500,
        open: 14,
        high: 16,
        low: 13,
        close: 15,
        volume: 500
      })
    })

    it('returns empty array for empty input', () => {
      expect(aggregateToFourHour([])).toEqual([])
    })
  })
})
