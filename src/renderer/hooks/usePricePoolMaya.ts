import { useObservableState } from 'observable-hooks'

import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { MAYA_PRICE_POOL } from '../helpers/poolHelperMaya'

export const usePricePoolMaya = () => {
  const {
    service: {
      pools: { selectedPricePool$ }
    }
  } = useMidgardMayaContext()

  const pricePool = useObservableState(selectedPricePool$, MAYA_PRICE_POOL)

  return pricePool
}
