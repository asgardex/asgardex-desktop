import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { getFromStorage, saveInStorage, StorageKey } from '../../helpers/storageHelper'
import { BaseUnit, BTC_BASE_UNITS } from '../../services/const'
import { AppState } from './types'

const initialState: AppState = {
  isPrivate: false,
  isWhitelistModalOpen: false,
  btcBaseUnit: JSON.parse(getFromStorage(StorageKey.BtcBaseUnit) ?? JSON.stringify(BTC_BASE_UNITS[0]))
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
    setBtcBaseUnit(state, action: PayloadAction<BaseUnit>) {
      state.btcBaseUnit = action.payload
      saveInStorage(StorageKey.BtcBaseUnit, JSON.stringify(action.payload))
    }
  }
})

export const { reducer, actions } = slice
