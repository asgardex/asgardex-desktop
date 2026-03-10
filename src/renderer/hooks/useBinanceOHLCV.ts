import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset } from '@xchainjs/xchain-util'
import axios from 'axios'
import { option as O, function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import {
  poolAssetToBinanceSymbol,
  timeframeToBinanceInterval,
  dateRangeToStartTime,
  binanceKlineToCandle
} from '../helpers/binanceHelper'
import type { BinanceKline } from '../helpers/binanceHelper'
import type { CandleTimeframe, ChartDateRange, OHLCVData, OHLCVDataRD } from '../views/pools/detail/types'

const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines'

type Params = {
  poolAsset: AnyAsset | null
  timeframe: CandleTimeframe
  dateRange: ChartDateRange
}

type Result = {
  dataRD: OHLCVDataRD
  hasBinance: boolean
}

export const useBinanceOHLCV = ({ poolAsset, timeframe, dateRange }: Params): Result => {
  // Use primitive string as dependency to avoid Option object identity issues
  const symbolStr = useMemo(
    () => (poolAsset ? FP.pipe(poolAssetToBinanceSymbol(poolAsset), O.toNullable) : null),
    [poolAsset]
  )

  const data$ = useMemo(() => {
    if (!symbolStr) return Rx.of(RD.initial as OHLCVDataRD)

    const interval = timeframeToBinanceInterval(timeframe)
    const startTime = dateRangeToStartTime(dateRange)

    return FP.pipe(
      Rx.defer(() =>
        Rx.from(
          axios.get<BinanceKline[]>(BINANCE_KLINES_URL, {
            params: { symbol: symbolStr, interval, startTime, limit: 1000 }
          })
        )
      ),
      RxOp.map(({ data: klines }) => {
        const candles: OHLCVData = klines.map(binanceKlineToCandle).sort((a, b) => a.time - b.time)
        return RD.success<Error, OHLCVData>(candles)
      }),
      RxOp.startWith(RD.pending as OHLCVDataRD),
      RxOp.catchError((e: unknown) =>
        Rx.of(RD.failure<Error, OHLCVData>(e instanceof Error ? e : new Error(String(e))))
      )
    )
  }, [symbolStr, timeframe, dateRange])

  const dataRD = useObservableState(data$, symbolStr ? RD.pending : RD.initial)

  return { dataRD, hasBinance: symbolStr !== null }
}
