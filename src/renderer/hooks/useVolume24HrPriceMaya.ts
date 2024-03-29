import * as RD from '@devexperts/remote-data-ts'
import { baseAmount, bnOrZero } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { sequenceTRD } from '../helpers/fpHelpers'
import { triggerStream } from '../helpers/stateHelper'
import { GetLiquidityHistoryIntervalEnum, GetSwapHistoryIntervalEnum, PriceRD } from '../services/midgard/types'
import { AssetWithAmount } from '../types/asgardex'
import { getValueOfRuneInAsset } from '../views/pools/Pools.utils'

const { stream$: reloadHistory$, trigger: reloadHistory } = triggerStream()

export const useVolume24PriceMaya = () => {
  const {
    service: {
      pools: { poolsState$, selectedPricePool$, apiGetSwapHistory$, apiGetLiquidityHistory$, reloadPools }
    }
  } = useMidgardMayaContext()

  const swapHistory$ = () =>
    FP.pipe(
      reloadHistory$,
      RxOp.switchMap((_) => apiGetSwapHistory$({ interval: GetSwapHistoryIntervalEnum.Day, count: 2 }))
    )

  const liquidityHistory$ = () =>
    FP.pipe(
      reloadHistory$,
      RxOp.switchMap((_) => apiGetLiquidityHistory$({ interval: GetLiquidityHistoryIntervalEnum.Day, count: 2 }))
    )

  const reloadVolume24Price = () => {
    // reload of pools are needed to calculate prices properly
    reloadPools()
    reloadHistory()
  }

  const [volume24PriceRD] = useObservableState<PriceRD>(
    () =>
      FP.pipe(
        Rx.combineLatest([swapHistory$(), liquidityHistory$(), poolsState$, selectedPricePool$]),
        RxOp.map(
          ([
            swapHistoryRD,
            liquidityHistoryRD,
            poolStateRD,
            { poolData: selectedPricePoolData, asset: pricePoolAsset }
          ]) =>
            FP.pipe(
              sequenceTRD(swapHistoryRD, liquidityHistoryRD, poolStateRD),
              RD.map(([{ intervals: swapIntervals }, { intervals: liquidityIntervals }, _]) => {
                const swapVol = baseAmount(bnOrZero(swapIntervals[0]?.totalVolume))
                const liquitidyVol = baseAmount(bnOrZero(liquidityIntervals[0]?.addLiquidityVolume))
                const withdrawVol = baseAmount(bnOrZero(liquidityIntervals[0]?.withdrawVolume))
                const volume24 = swapVol.plus(liquitidyVol).plus(withdrawVol)

                const volume24Price: AssetWithAmount = {
                  asset: pricePoolAsset,
                  amount: getValueOfRuneInAsset(volume24, selectedPricePoolData)
                }

                return volume24Price
              })
            )
        )
      ),
    RD.initial
  )

  return { volume24PriceRD, reloadVolume24Price }
}
