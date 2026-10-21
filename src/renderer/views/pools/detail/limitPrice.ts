import { chartPricePrecision } from './pairChart'

export type ChartUnit = 'usd' | 'pair'

/**
 * USD trigger for the price watcher.
 * The typed price and the chart close share a unit. The trigger is that ratio
 * times the THORChain pool USD price, so a click on the chart close stores the
 * current pool price even when Binance and the pool differ.
 */
export const limitTriggerUsd = (limitPrice: number, poolUsd: number, chartPrice: number): number | null => {
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) return null
  if (!Number.isFinite(poolUsd) || poolUsd <= 0) return null
  if (!Number.isFinite(chartPrice) || chartPrice <= 0) return null
  const usd = (limitPrice / chartPrice) * poolUsd
  if (!Number.isFinite(usd) || usd <= 0) return null
  return usd
}

/**
 * Chart-unit price of a stored THORChain USD trigger.
 * Inverse of limitTriggerUsd, so the line sits where the order was entered.
 */
export const levelPriceOnChart = (usd: number, poolUsd: number, chartPrice: number): number | null => {
  if (!Number.isFinite(usd) || usd <= 0) return null
  if (!Number.isFinite(poolUsd) || poolUsd <= 0) return null
  if (!Number.isFinite(chartPrice) || chartPrice <= 0) return null
  const onChart = (usd / poolUsd) * chartPrice
  if (!Number.isFinite(onChart) || onChart <= 0) return null
  return onChart
}

export type ChartLevelPrice = {
  levelPrice: number
  /** Missing means a THORChain USD trigger. */
  unit?: 'usd' | 'pair'
  chartUnit: ChartUnit
  poolUsd: number
  chartPrice: number
  /** Pool USD of the pair counter. Pair levels on a USD chart need it. */
  counterUsd?: number
}

/**
 * On-chart price of a stored level.
 * A pair level on a pair chart is the entered ratio. A USD level is scaled with levelPriceOnChart.
 * A pair level on a USD chart is the ratio times the counter's pool USD.
 */
export const chartLevelPrice = ({
  levelPrice,
  unit,
  chartUnit,
  poolUsd,
  chartPrice,
  counterUsd
}: ChartLevelPrice): number | null => {
  if (unit === 'pair') {
    if (chartUnit === 'pair') return Number.isFinite(levelPrice) && levelPrice > 0 ? levelPrice : null
    if (counterUsd === undefined || !Number.isFinite(counterUsd) || counterUsd <= 0) return null
    const usd = levelPrice * counterUsd
    if (!Number.isFinite(usd) || usd <= 0) return null
    return usd
  }
  return levelPriceOnChart(levelPrice, poolUsd, chartPrice)
}

export type PriceRange = { minValue: number; maxValue: number }

/** Keep an order line on screen when it sits outside the visible candles. */
export const priceRangeWithLevels = (range: PriceRange | null, levels: readonly number[]): PriceRange | null => {
  if (!range) return null
  let min = range.minValue
  let max = range.maxValue
  let outside = false
  for (const price of levels) {
    if (!Number.isFinite(price)) continue
    if (price < min) {
      min = price
      outside = true
    }
    if (price > max) {
      max = price
      outside = true
    }
  }
  if (!outside) return range
  const span = max - min
  const pad = span > 0 ? span * 0.08 : Math.abs(min) * 0.08 || 1
  return { minValue: min - pad, maxValue: max + pad }
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
