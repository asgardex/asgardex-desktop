import { useObservableState } from 'observable-hooks'

import { MAYA_PRICE_POOL } from '../helpers/poolHelperMaya'
import { useMidgardMayaContext } from 'contexts/MidgardMayaContext'

export const usePricePoolMaya = () => {
  const {
    service: {
      pools: { selectedPricePool$ }
    }
  } = useMidgardMayaContext()

  const pricePool = useObservableState(selectedPricePool$, MAYA_PRICE_POOL)

  return pricePool
}
