import type { OHLCVData } from './types'

export type ChartHeadline = {
  last: number
  /** Percent move from the first candle open to the last close. Null when that open is 0. */
  changePct: number | null
}

/** Last close and the move across the loaded candles. */
export const chartHeadline = (data: OHLCVData): ChartHeadline | null => {
  if (data.length === 0) return null
  const first = data[0]
  const last = data[data.length - 1]
  const changePct = first.open === 0 ? null : ((last.close - first.open) / first.open) * 100
  return { last: last.close, changePct }
}
