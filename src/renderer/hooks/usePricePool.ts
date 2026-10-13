import { useMemo } from 'react'

import * as Rx from 'rxjs'

import { useMidgardContext } from '../contexts/MidgardContext'
import { RUNE_PRICE_POOL } from '../helpers/poolHelper'
import { PricePool } from '../services/midgard/midgardTypes'
import { useObservableLayoutState } from './useObservableLayoutState'

export const usePricePool = (enabled = true) => {
  const {
    service: {
      pools: { selectedPricePool$ }
    }
  } = useMidgardContext()

  const source$ = useMemo(
    (): Rx.Observable<PricePool> => (enabled ? selectedPricePool$ : Rx.EMPTY),
    [enabled, selectedPricePool$]
  )

  return useObservableLayoutState(source$, RUNE_PRICE_POOL)
}
