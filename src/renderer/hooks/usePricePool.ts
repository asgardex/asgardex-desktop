import { useObservableState } from 'observable-hooks'

import { RUNE_PRICE_POOL } from '../helpers/poolHelper'
import { useMidgardContext } from 'contexts/MidgardContext'

export const usePricePool = () => {
  const {
    service: {
      pools: { selectedPricePool$ }
    }
  } = useMidgardContext()

  const pricePool = useObservableState(selectedPricePool$, RUNE_PRICE_POOL)

  return pricePool
}
