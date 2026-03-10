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
  binanceKlineToCandle,
  BinanceKline
} from '../helpers/binanceHelper'
import type { CandleTimeframe, ChartDateRange, OHLCVData, OHLCVDataRD } from '../views/pools/detail/types'

const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines'

type Params = {
  poolAsset: AnyAsset | null
  timeframe: CandleTimeframe
  dateRange: ChartDateRange
}

type Result = {
  dataRD: OHLCVDataRD
  binanceSymbol: O.Option<string>
}

export const useBinanceOHLCV = ({ poolAsset, timeframe, dateRange }: Params): Result => {
  const binanceSymbol = useMemo(() => (poolAsset ? poolAssetToBinanceSymbol(poolAsset) : O.none), [poolAsset])

  const data$ = useMemo(() => {
    return FP.pipe(
      binanceSymbol,
      O.fold(
        () => Rx.of(RD.initial as OHLCVDataRD),
        (symbol) => {
          const interval = timeframeToBinanceInterval(timeframe)
          const startTime = dateRangeToStartTime(dateRange)

          return FP.pipe(
            Rx.defer(() =>
              Rx.from(
                axios.get<BinanceKline[]>(BINANCE_KLINES_URL, {
                  params: {
                    symbol,
                    interval,
                    startTime,
                    limit: 1000
                  }
                })
              )
            ),
            RxOp.map(({ data: klines }) => {
              const candles: OHLCVData = klines.map(binanceKlineToCandle).sort((a, b) => a.time - b.time)
              return RD.success<Error, OHLCVData>(candles)
            }),
            RxOp.startWith(RD.pending as OHLCVDataRD),
            RxOp.catchError((e: Error) => Rx.of(RD.failure<Error, OHLCVData>(e)))
          )
        }
      )
    )
  }, [binanceSymbol, timeframe, dateRange])

  const dataRD = useObservableState(data$, O.isSome(binanceSymbol) ? RD.pending : RD.initial)

  return { dataRD, binanceSymbol }
}
