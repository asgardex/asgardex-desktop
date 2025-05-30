import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as RxOp from 'rxjs/operators'

import { useMidgardContext } from '../contexts/MidgardContext'
import { liveData } from '../helpers/rx/liveData'
import { PricePools } from '../services/midgard/midgardTypes'

export const usePricePools = () => {
  const {
    service: {
      pools: { poolsState$ }
    }
  } = useMidgardContext()

  const [pricePools] = useObservableState<O.Option<PricePools>>(
    () =>
      FP.pipe(
        poolsState$,
        liveData.map(({ pricePools }) => pricePools),
        RxOp.map(FP.flow(RD.toOption, O.flatten))
      ),
    O.none
  )

  return pricePools
}
