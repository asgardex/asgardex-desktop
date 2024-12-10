import { createSlice } from '@reduxjs/toolkit'

import * as geckoActions from './actions'
import { State } from './types'

const initialState: State = {
  isLoading: false,
  geckoPriceMap: {},
  lastUpdateInfo: {
    lastUpdatedAt: null,
    lastCoinIds: ''
  }
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
      .addCase(geckoActions.fetchPrice.fulfilled, (state, { meta, payload }) => {
        state.isLoading = false
        state.geckoPriceMap = payload
        state.lastUpdateInfo = {
          lastUpdatedAt: new Date().getTime(),
          lastCoinIds: meta.arg
        }
      })
      .addCase(geckoActions.fetchPrice.rejected, (state) => {
        state.isLoading = false
      })
})

export const { reducer, actions } = slice
