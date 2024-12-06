import { useCallback } from 'react'

import { QuoteSwapParams } from '@xchainjs/xchain-aggregator'
import { useSelector } from 'react-redux'

import { RootState, useAppDispatch } from '../store'
import * as xchainActions from './actions'

export const useAggregator = () => {
  const dispatch = useAppDispatch()

  // Selector to get the aggregator state
  const { aggregator, ...rest } = useSelector((state: RootState) => state.aggregator)

  /**
   * Estimate swap function
   * Dispatches `getEstimate` thunk and returns the result.
   */
  const estimateSwap = useCallback(
    async (params: QuoteSwapParams) => {
      try {
        const result = await dispatch(xchainActions.getEstimate({ aggregator, params })).unwrap()
        return result
      } catch (error) {
        console.error('Failed to fetch estimate:', error)
        throw error
      }
    },
    [aggregator, dispatch]
  )

  return {
    aggregator,
    ...rest,
    estimateSwap
  }
}
