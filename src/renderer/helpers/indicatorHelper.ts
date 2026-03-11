/**
 * Technical analysis indicator calculations.
 * All functions return arrays aligned with the input — `null` for initial periods
 * where there isn't enough data to compute the indicator.
 */

export const calculateSMA = (closes: number[], period: number): (number | null)[] => {
  if (period <= 0 || closes.length === 0) return closes.map(() => null)

  return closes.map((_, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j]
    }
    return sum / period
  })
}

export const calculateEMA = (closes: number[], period: number): (number | null)[] => {
  if (period <= 0 || closes.length === 0) return closes.map(() => null)
  if (period > closes.length) return closes.map(() => null)

  const multiplier = 2 / (period + 1)
  const result: (number | null)[] = new Array(closes.length).fill(null)

  // Seed with SMA of first `period` values
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += closes[i]
  }
  let ema = sum / period
  result[period - 1] = ema

  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema
    result[i] = ema
  }

  return result
}

export const calculateBollingerBands = (
  closes: number[],
  period: number,
  stdDevMultiplier: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } => {
  const middle = calculateSMA(closes, period)

  const upper: (number | null)[] = new Array(closes.length).fill(null)
  const lower: (number | null)[] = new Array(closes.length).fill(null)

  for (let i = 0; i < closes.length; i++) {
    const sma = middle[i]
    if (sma === null) continue

    let sumSquaredDiff = 0
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - sma
      sumSquaredDiff += diff * diff
    }
    const stdDev = Math.sqrt(sumSquaredDiff / period)
    upper[i] = sma + stdDevMultiplier * stdDev
    lower[i] = sma - stdDevMultiplier * stdDev
  }

  return { upper, middle, lower }
}
