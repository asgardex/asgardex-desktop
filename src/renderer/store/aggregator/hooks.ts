import { useCallback } from 'react'

import { QuoteSwapParams } from '@xchainjs/xchain-aggregator'
import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { useSelector } from 'react-redux'

import { getCurrentNetworkState } from '../../services/app/service'
import { RootState, useAppDispatch } from '../store'
import * as xchainActions from './actions'
import { actions } from './slice'

export const useAggregator = () => {
  const dispatch = useAppDispatch()
  const network = getCurrentNetworkState()

  // Selector to get aggregator state from Redux
  const { aggregator, protocols, ...rest } = useSelector((state: RootState) => state.aggregator)

  const setAggProtocol = useCallback(
    (protocol: Protocol, isActive: boolean) => {
      dispatch(actions.setProtocol({ protocol, isActive }))
    },
    [dispatch]
  )

  /**
   * Estimate swap function
   * Dispatches `getEstimate` thunk and returns the result.
   */
  const estimateSwap = useCallback(
    async (params: QuoteSwapParams, useAffiliate: boolean) => {
      try {
        const result = await dispatch(
          xchainActions.getEstimate({ aggregator, protocols, params, useAffiliate, network })
        ).unwrap()
        return result
      } catch (error) {
        console.error('Failed to fetch estimate:', error)
        throw error
      }
    },
    [aggregator, protocols, dispatch, network]
  )

  return {
    aggregator,
    protocols,
    ...rest,
    estimateSwap,
    setAggProtocol
  }
}
