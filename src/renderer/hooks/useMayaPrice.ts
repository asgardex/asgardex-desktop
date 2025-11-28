import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ONE_CACAO_BASE_AMOUNT } from '../../shared/mock/amount'
import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { sequenceTOption } from '../helpers/fpHelpers'
import { pricePoolSelector } from '../services/midgard/mayaMidgard/utils'
import { PriceRD } from '../services/midgard/midgardTypes'
import { getValueOfRuneInAsset } from '../views/pools/Pools.utils'

export const useMayaPrice = () => {
  const {
    service: {
      pools: { poolsState$, selectedPricePoolAsset$, reloadPools }
    }
  } = useMidgardMayaContext()

  const reloadMayaPrice = () => {
    // reload pools triggers changes of poolsState$, with it changes of `mayaPriceRD`
    reloadPools()
  }

  const [mayaPriceRD] = useObservableState<PriceRD>(
    () =>
      Rx.combineLatest([poolsState$, selectedPricePoolAsset$]).pipe(
        RxOp.map(([poolsState, oSelectedPricePoolAsset]) =>
          FP.pipe(
            poolsState,
            RD.chain(({ pricePools: oPricePools }) =>
              FP.pipe(
                sequenceTOption(oPricePools, oSelectedPricePoolAsset),
                O.map(([pricePools, pricePoolAsset]) => {
                  const { poolData } = pricePoolSelector(pricePools, O.some(pricePoolAsset))
                  return {
                    asset: pricePoolAsset,
                    amount: getValueOfRuneInAsset(ONE_CACAO_BASE_AMOUNT, poolData)
                  }
                }),
                (oMayaPrice) =>
                  RD.fromOption(oMayaPrice, () => Error('Could not get price for MAYA from selected price pool'))
              )
            )
          )
        )
      ),
    RD.initial
  )

  return { mayaPriceRD, reloadMayaPrice }
}
