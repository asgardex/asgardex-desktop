import { useCallback } from 'react'

import { QuoteSwapParams } from '@xchainjs/xchain-aggregator'
import { useSelector } from 'react-redux'

import { RootState, useAppDispatch } from '../store'
import * as xchainActions from './actions'

export const useAggregator = () => {
  const dispatch = useAppDispatch()

  const { aggregator, ...rest } = useSelector((state: RootState) => state.aggregator)

  const estimateSwap = useCallback(
    (params: QuoteSwapParams) => {
      dispatch(xchainActions.getEstimate({ aggregator, params }))
    },
    [aggregator, dispatch]
  )

  return {
    aggregator,
    ...rest,
    estimateSwap
  }
}
