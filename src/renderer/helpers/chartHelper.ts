import type { DepthHistoryItem } from '@xchainjs/xchain-midgard'

import { GetDepthHistoryIntervalEnum, GetSwapHistoryIntervalEnum } from '../services/midgard/midgardTypes'
import type { CandleTimeframe, ChartDateRange, OHLCVCandle } from '../views/pools/detail/types'

/**
 * Map candle timeframe to Midgard depth history interval.
 * 4H uses hourly data that gets aggregated client-side.
 */
export const getDepthInterval = (timeframe: CandleTimeframe): GetDepthHistoryIntervalEnum => {
  switch (timeframe) {
    case '1H':
    case '4H':
      return GetDepthHistoryIntervalEnum.Hour
    case '1D':
      return GetDepthHistoryIntervalEnum.Day
    case '1W':
      return GetDepthHistoryIntervalEnum.Week
  }
}

/**
 * Map candle timeframe to Midgard swap history interval.
 */
export const getSwapInterval = (timeframe: CandleTimeframe): GetSwapHistoryIntervalEnum => {
  switch (timeframe) {
    case '1H':
    case '4H':
      return GetSwapHistoryIntervalEnum.Hour
    case '1D':
      return GetSwapHistoryIntervalEnum.Day
    case '1W':
      return GetSwapHistoryIntervalEnum.Week
  }
}

const MIDGARD_MAX_COUNT = 400

/**
 * Calculate interval count for Midgard queries, capped at 400.
 * We only pass count (no from/to) — Midgard defaults to current time
 * and returns the most recent intervals.
 */
export const getCount = (dateRange: ChartDateRange, timeframe: CandleTimeframe): number => {
  const days: Record<ChartDateRange, number> = {
    '7d': 7,
    '30d': 30
  }
  const hoursPerInterval: Record<CandleTimeframe, number> = {
    '1H': 1,
    '4H': 1, // fetch hourly, aggregate client-side
    '1D': 24,
    '1W': 168
  }
  const totalHours = days[dateRange] * 24
  const intervals = Math.ceil(totalHours / hoursPerInterval[timeframe])
  return Math.min(intervals, MIDGARD_MAX_COUNT)
}

type PriceCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

/**
 * Extract OHLC from THORChain DepthHistoryItem.
 * Uses native OHLC fields when available, falls back to assetPriceUSD (flat candle).
 */
export const thorDepthItemToCandle = (item: DepthHistoryItem): PriceCandle => {
  const time = Number(item.startTime)
  const fallbackPrice = parseFloat(item.assetPriceUSD)

  const open = item.openPriceUSD ? parseFloat(item.openPriceUSD) : fallbackPrice
  const high = item.highPriceUSD ? parseFloat(item.highPriceUSD) : fallbackPrice
  const low = item.lowPriceUSD ? parseFloat(item.lowPriceUSD) : fallbackPrice
  const close = item.closePriceUSD ? parseFloat(item.closePriceUSD) : fallbackPrice

  return { time, open, high, low, close }
}

/**
 * Extract OHLC from MAYAChain DepthHistoryItem.
 * MAYAChain doesn't have native OHLC fields, so we always create a flat candle from assetPriceUSD.
 */
export const mayaDepthItemToCandle = (item: DepthHistoryItem): PriceCandle => {
  const time = Number(item.startTime)
  const price = parseFloat(item.assetPriceUSD)

  return { time, open: price, high: price, low: price, close: price }
}

/**
 * Extract volume from SwapHistoryItem.
 * totalVolumeUSD is Int64(e2) — divide by 100 to get USD.
 * Uses a structural type to support both THOR and MAYA SwapHistoryItem.
 */
export const swapItemToVolume = (item: {
  startTime: string
  totalVolumeUSD: string
}): { time: number; volume: number } => ({
  time: Number(item.startTime),
  volume: parseFloat(item.totalVolumeUSD) / 100
})

/**
 * Merge price candles with volume data by matching timestamps.
 * Candles without matching volume get volume=0.
 */
export const mergeOHLCV = (candles: PriceCandle[], volumes: { time: number; volume: number }[]): OHLCVCandle[] => {
  const volumeMap = new Map(volumes.map((v) => [v.time, v.volume]))
  return candles.map((c) => ({
    ...c,
    volume: volumeMap.get(c.time) ?? 0
  }))
}

/**
 * Aggregate hourly candles into 4-hour candles.
 * Groups consecutive candles into chunks of 4.
 */
export const aggregateToFourHour = (hourlyCandles: OHLCVCandle[]): OHLCVCandle[] => {
  if (hourlyCandles.length === 0) return []

  const sorted = [...hourlyCandles].sort((a, b) => a.time - b.time)
  const result: OHLCVCandle[] = []

  for (let i = 0; i < sorted.length; i += 4) {
    const chunk = sorted.slice(i, i + 4)
    const first = chunk[0]
    const last = chunk[chunk.length - 1]

    result.push({
      time: first.time,
      open: first.open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: last.close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0)
    })
  }

  return result
}
