import { chartPricePrecision } from './pairChart'

export type ChartUnit = 'usd' | 'pair'

/**
 * USD trigger for the price watcher.
 * A dollar chart click is already USD. A pair click is counter units per chart asset,
 * scaled by the live chart ratio and the THORChain pool USD price.
 */
export const limitTriggerUsd = (
  limitPrice: number,
  chartUnit: ChartUnit,
  poolUsd: number,
  chartPrice: number
): number | null => {
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) return null
  if (chartUnit === 'usd') return limitPrice
  if (!Number.isFinite(poolUsd) || poolUsd <= 0) return null
  if (!Number.isFinite(chartPrice) || chartPrice <= 0) return null
  const usd = (limitPrice / chartPrice) * poolUsd
  if (!Number.isFinite(usd) || usd <= 0) return null
  return usd
}

export type LimitVsMarket = {
  /** A sell is at or below the market, or a buy is at or above it. The watcher fills on the next check. */
  immediate: boolean
  /** Limit minus market, as a percent of the market. Positive means the limit is higher. */
  percentFromMarket: number
}

/**
 * Compare a limit to the price on the chart, in the same units.
 * That comparison matches the USD trigger: the conversion is a positive scale of this ratio.
 */
export const limitVsMarket = (side: 'buy' | 'sell', limitPrice: number, marketPrice: number): LimitVsMarket | null => {
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) return null
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) return null
  const percentFromMarket = ((limitPrice - marketPrice) / marketPrice) * 100
  if (!Number.isFinite(percentFromMarket)) return null
  const immediate = side === 'sell' ? limitPrice <= marketPrice : limitPrice >= marketPrice
  return { immediate, percentFromMarket }
}

/** Chart-unit price for the limit field. No grouping, so the input can stay numeric. */
export const formatLimitInput = (price: number): string => {
  if (!Number.isFinite(price) || price <= 0) return ''
  const digits = chartPricePrecision(price)
  return price.toFixed(digits).replace(/\.?0+$/, '')
}
