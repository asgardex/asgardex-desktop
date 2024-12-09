import { useCallback } from 'react'

import { useSelector } from 'react-redux'

import { RootState, useAppDispatch } from '../store'
import * as geckoActions from './actions'

export const useCoingecko = () => {
  const dispatch = useAppDispatch()

  const { lastUpdatedAt, ...rest } = useSelector((state: RootState) => state.gecko)

  /**
   * Fetch token price from Coingecko
   * Dispatches `fetchPrice` thunk and returns the result.
   */
  const fetchPrice = useCallback(
    (coinIds: string) => {
      const currentTime = new Date().getTime()

      // 10 mins
      if ((lastUpdatedAt !== null && currentTime - lastUpdatedAt < 10 * 60 * 1000) || lastUpdatedAt === null)
        dispatch(geckoActions.fetchPrice(coinIds))
    },
    [lastUpdatedAt, dispatch]
  )

  return {
    ...rest,
    fetchPrice
  }
}
