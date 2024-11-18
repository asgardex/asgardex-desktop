import { createAsyncThunk } from '@reduxjs/toolkit'
import { Aggregator, QuoteSwapParams } from '@xchainjs/xchain-aggregator'

export const getEstimate = createAsyncThunk(
  'aggregator/estimate',
  async ({ aggregator, params }: { aggregator: Aggregator; params: QuoteSwapParams }) => {
    try {
      const estimate = await aggregator.estimateSwap(params)

      return estimate
    } catch (error) {
      console.error(error)
      throw error
    }
  }
)
