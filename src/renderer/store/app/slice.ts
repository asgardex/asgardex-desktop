import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { AppState } from './types'

const initialState: AppState = {
  isPrivate: false,
  isWhitelistModalOpen: false
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
    }
  }
})

export const { reducer, actions } = slice
