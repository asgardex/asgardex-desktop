import * as RD from '@devexperts/remote-data-ts'

export type CandleTimeframe = '1H' | '4H' | '1D' | '1W'

export type ChartDateRange = '7d' | '30d'

export type OHLCVCandle = {
  time: number // unix timestamp in seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type OHLCVData = OHLCVCandle[]

export type OHLCVDataRD = RD.RemoteData<Error, OHLCVData>

export type IndicatorType = 'SMA' | 'EMA' | 'BB'

export type IndicatorConfig = {
  type: IndicatorType
  enabled: boolean
  period: number
  color: string
}
