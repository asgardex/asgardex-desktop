import { useMemo } from 'react'

import * as Rx from 'rxjs'

import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { MAYA_PRICE_POOL } from '../helpers/poolHelperMaya'
import { PricePool } from '../services/midgard/midgardTypes'
import { useObservableLayoutState } from './useObservableLayoutState'

export const usePricePoolMaya = (enabled = true) => {
  const {
    service: {
      pools: { selectedPricePool$ }
    }
  } = useMidgardMayaContext()

  const source$ = useMemo(
    (): Rx.Observable<PricePool> => (enabled ? selectedPricePool$ : Rx.EMPTY),
    [enabled, selectedPricePool$]
  )

  return useObservableLayoutState(source$, MAYA_PRICE_POOL)
}
