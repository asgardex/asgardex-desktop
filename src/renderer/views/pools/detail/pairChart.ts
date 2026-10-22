import type { OHLCVCandle, OHLCVData } from './types'

const divide = (base: number, quote: number): number | null => {
  if (!Number.isFinite(base) || !Number.isFinite(quote) || quote === 0) return null
  return base / quote
}

/**
 * Counter units per 1 chart asset. Candles line up on `time`.
 * High and low use the other candle's opposite extreme, because a kline has no path inside the bar.
 * Volume stays on the chart asset.
 */
export const ratioCandles = (base: OHLCVData, quote: OHLCVData): OHLCVData => {
  const quoteByTime = new Map(quote.map((candle) => [candle.time, candle]))
  const out: OHLCVCandle[] = []
  for (const candle of base) {
    const other = quoteByTime.get(candle.time)
    if (!other) continue
    const open = divide(candle.open, other.open)
    const close = divide(candle.close, other.close)
    const upper = divide(candle.high, other.low)
    const lower = divide(candle.low, other.high)
    if (open === null || close === null || upper === null || lower === null) continue
    const extremes = [open, close, upper, lower]
    out.push({
      time: candle.time,
      open,
      close,
      high: Math.max(...extremes),
      low: Math.min(...extremes),
      volume: candle.volume
    })
  }
  return out
}

/** Decimal places for a price label and the chart axis. */
export const chartPricePrecision = (price: number): number => {
  const abs = Math.abs(price)
  if (!Number.isFinite(abs) || abs === 0) return 4
  if (abs >= 1000) return 2
  if (abs >= 1) return 4
  if (abs >= 0.01) return 6
  return 8
}

export const chartPriceFormat = (price: number): { type: 'price'; precision: number; minMove: number } => {
  const precision = chartPricePrecision(price)
  return { type: 'price', precision, minMove: 10 ** -precision }
}

/** Pair price, quoted in the counter ticker. No currency symbol. */
export const formatChartAmount = (value: number, ticker: string): string => {
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: chartPricePrecision(value)
  }).format(value)
  return `${text} ${ticker}`
}
