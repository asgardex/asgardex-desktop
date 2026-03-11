import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'

import type { OHLCVDataRD } from '../views/pools/detail/types'

export type SpreadInfo = {
  midgardPrice: number
  binancePrice: number
  spreadPct: number
  /** 'premium' = THORChain more expensive, 'discount' = THORChain cheaper */
  spreadDirection: 'premium' | 'discount' | 'equal'
}

export type SpreadInfoRD = RD.RemoteData<Error, SpreadInfo>

/**
 * Compare last close prices from Midgard and Binance data to calculate spread.
 * Returns RD.initial if either source is not in success state.
 */
export const usePriceSpread = (midgardDataRD: OHLCVDataRD, binanceDataRD: OHLCVDataRD): SpreadInfoRD => {
  return useMemo(
    () =>
      FP.pipe(
        RD.combine(midgardDataRD, binanceDataRD),
        RD.chain(([midgardData, binanceData]) => {
          if (midgardData.length === 0 || binanceData.length === 0) {
            return RD.failure<Error, SpreadInfo>(new Error('No data available for spread calculation'))
          }

          const midgardPrice = midgardData[midgardData.length - 1].close
          const binancePrice = binanceData[binanceData.length - 1].close

          if (binancePrice === 0) {
            return RD.failure<Error, SpreadInfo>(new Error('Binance price is zero'))
          }

          const spreadPct = ((midgardPrice - binancePrice) / binancePrice) * 100
          const spreadDirection: SpreadInfo['spreadDirection'] =
            Math.abs(spreadPct) < 0.01 ? 'equal' : spreadPct > 0 ? 'premium' : 'discount'

          return RD.success<Error, SpreadInfo>({
            midgardPrice,
            binancePrice,
            spreadPct,
            spreadDirection
          })
        })
      ),
    [midgardDataRD, binanceDataRD]
  )
}
