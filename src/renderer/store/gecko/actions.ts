import { createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'

import { logger } from '../../helpers/logger'

export const fetchPrice = createAsyncThunk('coingecko/price', async (coinIds: string) => {
  try {
    const { data: geckoPrice } = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`
    )

    return geckoPrice
  } catch (error) {
    logger.error(error)
    throw error
  }
})
