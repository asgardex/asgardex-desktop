import { createSlice } from '@reduxjs/toolkit'

import * as geckoActions from './actions'
import { State } from './types'

const initialState: State = {
  isLoading: false,
  geckoPriceMap: {},
  lastUpdatedAt: null
}

const slice = createSlice({
  name: 'coingecko',
  initialState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(geckoActions.fetchPrice.pending, (state) => {
        state.isLoading = true
      })
      .addCase(geckoActions.fetchPrice.fulfilled, (state, { payload }) => {
        state.isLoading = false
        state.geckoPriceMap = payload
        state.lastUpdatedAt = new Date().getTime()
      })
      .addCase(geckoActions.fetchPrice.rejected, (state) => {
        state.isLoading = false
      })
})

export const { reducer, actions } = slice
