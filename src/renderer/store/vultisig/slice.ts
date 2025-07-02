import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { v4 as uuidv4 } from 'uuid'

import { getHexEncodedRandomBytes } from '../../vultisig/lib/utils/crypto/getHexEncodedRandomBytes'
import { generateLocalPartyId } from '../../vultisig/mpc/devices/localPartyId'
import { State, VaultWithCoin } from './types'

const initialState: State = {
  vaultName: '',
  localPartyId: '',
  sessionId: '',
  hexChainCode: '',
  hexEncryptionKey: '',
  mpcServerUrl: '',
  peers: [],
  vault: null
}

const slice = createSlice({
  name: 'vultisig',
  initialState,
  reducers: {
    initFastVault(state) {
      state.localPartyId = generateLocalPartyId('windows')
      state.sessionId = uuidv4()
      state.hexChainCode = getHexEncodedRandomBytes(32)
      state.hexEncryptionKey = getHexEncodedRandomBytes(32)
      state.mpcServerUrl = 'https://api.vultisig.com/router'
    },
    setMpcPeers(state, { payload }: PayloadAction<string[]>) {
      state.peers = payload
    },
    setVaultName(state, { payload }: PayloadAction<string>) {
      state.vaultName = payload
    },
    setVault(state, { payload }: PayloadAction<VaultWithCoin>) {
      state.vault = payload
    }
  }
})

export const { reducer, actions } = slice
