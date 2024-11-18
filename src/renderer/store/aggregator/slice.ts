import { createSlice } from '@reduxjs/toolkit'
import { Aggregator } from '@xchainjs/xchain-aggregator'

import { State } from './types'

const initialState: State = {
  isLoading: false,
  aggregator: new Aggregator({
    protocols: ['Thorchain', 'Mayachain']
  }),
  quoteSwap: null
}

const slice = createSlice({
  name: 'aggregator',
  initialState,
  reducers: {}
})

export const { reducer, actions } = slice
