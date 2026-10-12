import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { Chain } from '@xchainjs/xchain-util'
import { THORChain } from '../../../shared/utils/chainIds'

import { AppState } from './types'

const initialState: AppState = {
  isPrivate: false,
  isWhitelistModalOpen: false,
  protocol: THORChain
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
    }
  }
})

export const { reducer, actions } = slice
