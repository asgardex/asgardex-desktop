import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

import { AppState } from './types'

const initialState: AppState = {
  isPrivate: false,
  isWhitelistModalOpen: false,
  protocol: THORChain,
  streamingSlip: 0.5,
  instantSlip: 0.5,
  tradeSlip: 0.5
}

const slice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    changePrivateData(state, action: PayloadAction<boolean>) {
      state.isPrivate = action.payload
    },
    setIsWhitelistModalOpen(state, action: PayloadAction<boolean>) {
      state.isWhitelistModalOpen = action.payload
    },
    setProtocol(state, action: PayloadAction<Chain>) {
      state.protocol = action.payload
    },
    setStreamingSlip(state, action: PayloadAction<number>) {
      state.streamingSlip = action.payload
    },
    setInstantSlip(state, action: PayloadAction<number>) {
      state.instantSlip = action.payload
    },
    setTradeSlip(state, action: PayloadAction<number>) {
      state.tradeSlip = action.payload
    }
  }
})

export const { reducer, actions } = slice
