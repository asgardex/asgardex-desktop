import { useCallback } from 'react'

import { useSelector } from 'react-redux'

import { RootState, useAppDispatch } from '../store'
import * as geckoActions from './actions'

export const useCoingecko = () => {
  const dispatch = useAppDispatch()

  const { lastUpdateInfo, ...rest } = useSelector((state: RootState) => state.gecko)

  /**
   * Fetch token price from Coingecko
   * Dispatches `fetchPrice` thunk
   */
  const fetchPrice = useCallback(
    (coinIds: string) => {
      const currentTime = new Date().getTime()
      const { lastCoinIds, lastUpdatedAt } = lastUpdateInfo

      // 10 mins
      if ((lastCoinIds === coinIds && currentTime - (lastUpdatedAt ?? 0) > 10 * 60 * 1000) || lastCoinIds !== coinIds)
        dispatch(geckoActions.fetchPrice(coinIds))
    },
    [lastUpdateInfo, dispatch]
  )

  return {
    ...rest,
    fetchPrice
  }
}
