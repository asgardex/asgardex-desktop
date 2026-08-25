import { useCallback } from 'react'

import { QuoteSwapParams } from '@xchainjs/xchain-aggregator'
import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { useSelector } from 'react-redux'

import { logger } from '../../helpers/logger'
import { getCurrentNetworkState } from '../../services/app/service'
import { RootState, useAppDispatch } from '../store'
import * as xchainActions from './actions'
import { actions } from './slice'

export const useAggregator = () => {
  const dispatch = useAppDispatch()
  const network = getCurrentNetworkState()

  // Selector to get aggregator state from Redux
  const { aggregator, protocols, isBoostEnabled, ...rest } = useSelector((state: RootState) => state.aggregator)

  const setAggProtocol = useCallback(
    (protocol: Protocol, isActive: boolean) => {
      dispatch(actions.setProtocol({ protocol, isActive }))
    },
    [dispatch]
  )

  const setBoostEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(actions.setBoostEnabled(enabled))
    },
    [dispatch]
  )

  /**
   * Estimate swap function
   * Dispatches `getEstimate` thunk and returns the result.
   * `protocolsOverride` lets callers drop halted THOR/MAYA routes before the aggregator request.
   */
  const estimateSwap = useCallback(
    async (params: QuoteSwapParams, useAffiliate: boolean, protocolsOverride?: Protocol[]) => {
      try {
        const result = await dispatch(
          xchainActions.getEstimate({
            aggregator,
            protocols: protocolsOverride ?? protocols,
            params,
            useAffiliate,
            network
          })
        ).unwrap()
        return result
      } catch (error) {
        logger.error('Failed to fetch estimate:', error)
        throw error
      }
    },
    [aggregator, protocols, dispatch, network]
  )

  /**
   * Open a live Chainflip deposit channel immediately before broadcast.
   * Aggregator 3.0+: estimateSwap is quote-only and does not create channels.
   */
  const requestChainflipDepositAddress = useCallback(
    (params: QuoteSwapParams) => aggregator.requestChainflipDepositAddress(params),
    [aggregator]
  )

  return {
    aggregator,
    protocols,
    isBoostEnabled,
    ...rest,
    estimateSwap,
    requestChainflipDepositAddress,
    setAggProtocol,
    setBoostEnabled
  }
}
