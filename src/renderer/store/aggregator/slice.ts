import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Protocol } from '@xchainjs/xchain-aggregator/lib/types'

import { getProtocolFromStorage, setValueToStorage, StorageKey } from '../../helpers/storage'
import { State } from './types'

const AllProtocols: Protocol[] = ['Thorchain', 'Mayachain', 'Chainflip', 'OneClick']

const initialState: State = {
  isLoading: false,
  protocols: JSON.parse(getProtocolFromStorage(JSON.stringify(AllProtocols))),
  isBoostEnabled: false, // Boost disabled by default
  quoteSwap: null
}

const slice = createSlice({
  name: 'aggregator',
  initialState,
  reducers: {
    setProtocol(state, { payload: { protocol, isActive } }: PayloadAction<{ protocol: Protocol; isActive: boolean }>) {
      if (isActive) {
        state.protocols = [...state.protocols, protocol]
      } else {
        const newProtocols = state.protocols.filter((item) => item !== protocol)

        if (newProtocols.length === 0) state.protocols = AllProtocols.filter((item) => item !== protocol)
        else state.protocols = newProtocols
      }

      setValueToStorage(StorageKey.Protocol, JSON.stringify(state.protocols))
    },
    setBoostEnabled(state, { payload }: PayloadAction<boolean>) {
      state.isBoostEnabled = payload
    }
  }
})

export const { reducer, actions } = slice
