import * as RD from '@devexperts/remote-data-ts'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { CryptoAmount } from '@xchainjs/xchain-thorchain-query'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ONE_RUNE_BASE_AMOUNT } from '../../shared/mock/amount'
import { useMidgardContext } from '../contexts/MidgardContext'
import { useThorchainQueryContext } from '../contexts/ThorchainQueryContext'
import { sequenceTOption } from '../helpers/fpHelpers'
import { PriceRD } from '../services/midgard/types'

export const useRunePrice = () => {
  const {
    thorchainQuery: { thorchainCache }
  } = useThorchainQueryContext()
  const {
    service: {
      pools: { poolsState$, selectedPricePoolAsset$, reloadPools }
    }
  } = useMidgardContext()

  const reloadRunePrice = () => {
    // reload pools triggers changes of poolsState$, with it changes of `runePriceRD`
    reloadPools()
  }
  const ONE_RUNE = new CryptoAmount(ONE_RUNE_BASE_AMOUNT, AssetRuneNative)

  const [runePriceRD] = useObservableState<PriceRD>(
    () =>
      Rx.combineLatest([poolsState$, selectedPricePoolAsset$]).pipe(
        RxOp.switchMap(([poolsState, oSelectedPricePoolAsset]) => {
          return FP.pipe(
            poolsState,
            RD.toOption,
            O.chain(({ pricePools: oPricePools }) => sequenceTOption(oPricePools, oSelectedPricePoolAsset)),
            O.fold(
              () => Rx.of(RD.failure(new Error('No price pools found'))),
              ([, pricePoolAsset]) => {
                return Rx.from(thorchainCache.convert(ONE_RUNE, pricePoolAsset)).pipe(
                  RxOp.map((runePrice) =>
                    RD.success({
                      asset: pricePoolAsset,
                      amount: runePrice.baseAmount
                    })
                  ),
                  RxOp.catchError((error) => Rx.of(RD.failure(error)))
                )
              }
            )
          )
        }),
        RxOp.startWith(RD.initial)
      ),
    RD.initial
  )

  return { runePriceRD, reloadRunePrice }
}
