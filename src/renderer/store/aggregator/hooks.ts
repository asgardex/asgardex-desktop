import { useCallback } from 'react'

import type { QuoteSwapParams } from '@xchainjs/xchain-aggregator'
import type { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { useSelector } from 'react-redux'

import { logger } from '../../helpers/logger'
import { getCurrentNetworkState } from '../../services/app/service'
import { RootState, useAppDispatch } from '../store'
import * as xchainActions from './actions'
import { getAggregator } from './client'
import { actions } from './slice'

export const useAggregator = () => {
  const dispatch = useAppDispatch()
  const network = getCurrentNetworkState()

  const { protocols, isBoostEnabled, ...rest } = useSelector((state: RootState) => state.aggregator)

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
    [protocols, dispatch, network]
  )

  /**
   * Open a live Chainflip deposit channel immediately before broadcast.
   * Aggregator 3.0+: estimateSwap is quote-only and does not create channels.
   */
  const requestChainflipDepositAddress = useCallback(async (params: QuoteSwapParams) => {
    const aggregator = await getAggregator()
    return aggregator.requestChainflipDepositAddress(params)
  }, [])

  /**
   * Wet OneClick quote → deposit address. Aggregator 3.2+: estimateSwap is dry /
   * quote-only; call this immediately before broadcast (same pattern as Chainflip).
   */
  const requestOneClickDepositAddress = useCallback(async (params: QuoteSwapParams) => {
    const aggregator = await getAggregator()
    return aggregator.requestOneClickDepositAddress(params)
  }, [])

  /**
   * Register an already-broadcast OneClick deposit (or retry registration).
   */
  const submitOneClickDeposit = useCallback(async (txHash: string, depositAddress: string) => {
    const aggregator = await getAggregator()
    return aggregator.submitOneClickDeposit(txHash, depositAddress)
  }, [])

  return {
    protocols,
    isBoostEnabled,
    ...rest,
    estimateSwap,
    requestChainflipDepositAddress,
    requestOneClickDepositAddress,
    submitOneClickDeposit,
    setAggProtocol,
    setBoostEnabled
  }
}
