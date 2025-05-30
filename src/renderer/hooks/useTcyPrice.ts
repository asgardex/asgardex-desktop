import * as RD from '@devexperts/remote-data-ts'
import * as FP from 'fp-ts/lib/function'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useMidgardContext } from '../contexts/MidgardContext'

export const useTcyPrice = () => {
  const {
    service: {
      pools: { poolsState$, selectedPricePoolAsset$, reloadPools }
    }
  } = useMidgardContext()

  const reloadTcyPrice = () => {
    // reload pools triggers changes of poolsState$, with it changes of `tcyPriceRD`
    reloadPools()
  }

  const [tcyPriceRD] = useObservableState(
    () =>
      Rx.combineLatest([poolsState$, selectedPricePoolAsset$]).pipe(
        RxOp.map(([poolsState]) =>
          FP.pipe(
            poolsState,
            RD.chain(({ poolDetails }) => {
              const tcyPrice = poolDetails.find((pool) => pool.asset === 'THOR.TCY')?.assetPriceUSD ?? '0'
              return RD.success(`$${parseFloat(tcyPrice).toFixed(2)}`)
            })
          )
        )
      ),
    RD.initial
  )

  return { tcyPriceRD, reloadTcyPrice }
}
