import { assetFromString } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import {
  poolAssetToBinanceSymbol,
  timeframeToBinanceInterval,
  dateRangeToStartTime,
  binanceKlineToCandle,
  BinanceKline
} from './binanceHelper'

describe('binanceHelper', () => {
  describe('poolAssetToBinanceSymbol', () => {
    it('maps BTC ticker to BTCUSDT', () => {
      const asset = assetFromString('BTC.BTC')!
      const result = poolAssetToBinanceSymbol(asset)
      expect(O.isSome(result)).toBe(true)
      expect(O.toNullable(result)).toBe('BTCUSDT')
    })

    it('maps ETH ticker to ETHUSDT', () => {
      const asset = assetFromString('ETH.ETH')!
      expect(O.toNullable(poolAssetToBinanceSymbol(asset))).toBe('ETHUSDT')
    })

    it('maps RUNE ticker to RUNEUSDT', () => {
      const asset = assetFromString('THOR.RUNE')!
      expect(O.toNullable(poolAssetToBinanceSymbol(asset))).toBe('RUNEUSDT')
    })

    it('maps BNB ticker to BNBUSDT', () => {
      const asset = assetFromString('BSC.BNB')!
      expect(O.toNullable(poolAssetToBinanceSymbol(asset))).toBe('BNBUSDT')
    })

    it('returns O.none for CACAO (not on Binance)', () => {
      const asset = assetFromString('MAYA.CACAO')!
      expect(O.isNone(poolAssetToBinanceSymbol(asset))).toBe(true)
    })

    it('returns O.none for unknown ticker', () => {
      const asset = assetFromString('SOME.UNKNOWN')!
      expect(O.isNone(poolAssetToBinanceSymbol(asset))).toBe(true)
    })
  })

  describe('timeframeToBinanceInterval', () => {
    it('maps 1H to 1h', () => {
      expect(timeframeToBinanceInterval('1H')).toBe('1h')
    })
    it('maps 4H to 4h', () => {
      expect(timeframeToBinanceInterval('4H')).toBe('4h')
    })
    it('maps 1D to 1d', () => {
      expect(timeframeToBinanceInterval('1D')).toBe('1d')
    })
    it('maps 1W to 1w', () => {
      expect(timeframeToBinanceInterval('1W')).toBe('1w')
    })
  })

  describe('dateRangeToStartTime', () => {
    it('returns a timestamp ~7 days ago for 7d', () => {
      const now = Date.now()
      const start = dateRangeToStartTime('7d')
      const diffDays = (now - start) / (24 * 60 * 60 * 1000)
      expect(diffDays).toBeCloseTo(7, 0)
    })

    it('returns a timestamp ~30 days ago for 30d', () => {
      const now = Date.now()
      const start = dateRangeToStartTime('30d')
      const diffDays = (now - start) / (24 * 60 * 60 * 1000)
      expect(diffDays).toBeCloseTo(30, 0)
    })

    it('returns a timestamp ~30 days ago for 30d', () => {
      const now = Date.now()
      const start = dateRangeToStartTime('30d')
      const diffDays = (now - start) / (24 * 60 * 60 * 1000)
      expect(diffDays).toBeCloseTo(30, 0)
    })
  })

  describe('binanceKlineToCandle', () => {
    it('transforms kline array to OHLCVCandle', () => {
      const kline: BinanceKline = [
        1700000000000, // openTime in ms
        '67000.00',
        '68000.00',
        '66500.00',
        '67500.00',
        '1234.56',
        1700003600000,
        '82345678.90',
        5000,
        '600.00',
        '40200000.00',
        '0'
      ]
      const candle = binanceKlineToCandle(kline)
      expect(candle).toEqual({
        time: 1700000000, // ms → seconds
        open: 67000.0,
        high: 68000.0,
        low: 66500.0,
        close: 67500.0,
        volume: 1234.56
      })
    })

    it('handles small decimal values', () => {
      const kline: BinanceKline = [
        1700000000000,
        '0.08123',
        '0.08500',
        '0.07900',
        '0.08200',
        '999999.99',
        1700003600000,
        '82000.00',
        1000,
        '500000.00',
        '41000.00',
        '0'
      ]
      const candle = binanceKlineToCandle(kline)
      expect(candle.open).toBeCloseTo(0.08123)
      expect(candle.close).toBeCloseTo(0.082)
      expect(candle.volume).toBeCloseTo(999999.99)
    })
  })
})
