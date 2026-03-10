import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, assetFromString, assetToString } from '@xchainjs/xchain-util'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useMidgardContext } from '../contexts/MidgardContext'
import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import {
  getCount,
  getDepthInterval,
  getSwapInterval,
  thorDepthItemToCandle,
  mayaDepthItemToCandle,
  swapItemToVolume,
  mergeOHLCV,
  aggregateToFourHour
} from '../helpers/chartHelper'
import { useApp } from '../store/app/hooks'
import type { CandleTimeframe, ChartDateRange, OHLCVData, OHLCVDataRD } from '../views/pools/detail/types'

type Params = {
  poolAsset: AnyAsset | null
  timeframe: CandleTimeframe
  dateRange: ChartDateRange
}

export const useOHLCVData = ({ poolAsset, timeframe, dateRange }: Params): OHLCVDataRD => {
  const { protocol } = useApp()

  const {
    service: {
      pools: { apiGetDepthHistory$: thorDepthHistory$, apiGetSwapHistory$: thorSwapHistory$ }
    }
  } = useMidgardContext()

  const {
    service: {
      pools: { apiGetDepthHistory$: mayaDepthHistory$, apiGetSwapHistory$: mayaSwapHistory$ }
    }
  } = useMidgardMayaContext()

  const isThor = protocol === THORChain
  // Stabilize by string so useMemo doesn't re-run on every render
  const poolAssetStr = poolAsset ? assetToString(poolAsset) : ''

  const data$ = useMemo(() => {
    if (!poolAssetStr) return Rx.of(RD.initial as RD.RemoteData<Error, OHLCVData>)

    const asset = assetFromString(poolAssetStr)!
    const count = getCount(dateRange, timeframe)
    const depthInterval = getDepthInterval(timeframe)
    const swapInterval = getSwapInterval(timeframe)

    const depthHistory$ = isThor ? thorDepthHistory$ : mayaDepthHistory$

    // Only pass count — Midgard defaults to current time and returns the most recent intervals
    const depth$ = depthHistory$({ poolAsset: asset, interval: depthInterval, count })

    // Fetch swap volumes — use THOR or MAYA service, map intervals to volume via structural typing
    const volume$ = isThor
      ? FP.pipe(
          thorSwapHistory$({ poolAsset: asset, interval: swapInterval, count }),
          RxOp.map(RD.map((s) => s.intervals.map(swapItemToVolume)))
        )
      : FP.pipe(
          mayaSwapHistory$({ poolAsset: asset, interval: swapInterval, count }),
          RxOp.map(RD.map((s) => s.intervals.map(swapItemToVolume)))
        )

    const depthItemToCandle = isThor ? thorDepthItemToCandle : mayaDepthItemToCandle

    return FP.pipe(
      Rx.combineLatest([depth$, volume$]),
      RxOp.map(([depthRD, volumeRD]) =>
        FP.pipe(
          RD.combine(depthRD, volumeRD),
          RD.map(([depth, volumes]) => {
            const candles = depth.intervals.map(depthItemToCandle)
            const merged = mergeOHLCV(candles, volumes)
            const result = timeframe === '4H' ? aggregateToFourHour(merged) : merged
            // Ensure ascending time order for lightweight-charts
            return result.sort((a, b) => a.time - b.time)
          })
        )
      ),
      RxOp.catchError((e: Error) => Rx.of(RD.failure<Error, OHLCVData>(e)))
    )
  }, [
    poolAssetStr,
    timeframe,
    dateRange,
    isThor,
    thorDepthHistory$,
    mayaDepthHistory$,
    thorSwapHistory$,
    mayaSwapHistory$
  ])

  return useObservableState(data$, RD.pending)
}
