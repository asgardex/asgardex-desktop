import { describe, it, expect } from 'vitest'

import { ASGARDEX_TO_SDK_CHAIN, SDK_TO_ASGARDEX_CHAIN, MpcIPCMessages } from './mpcTypes'

describe('shared/api/mpcTypes', () => {
  describe('ASGARDEX_TO_SDK_CHAIN', () => {
    it.skip('contains 20 chain mappings', () => {
      // XRD/Radix temporarily removed from ASGARDEX_TO_SDK_CHAIN — re-enable when Radix is re-added
      expect(Object.keys(ASGARDEX_TO_SDK_CHAIN)).toHaveLength(20)
    })

    it('has no duplicate SDK chain values', () => {
      const values = Object.values(ASGARDEX_TO_SDK_CHAIN)
      const uniqueValues = new Set(values)
      expect(uniqueValues.size).toBe(values.length)
    })

    it('maps BTC to Bitcoin', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['BTC']).toBe('Bitcoin')
    })

    it('maps ETH to Ethereum', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['ETH']).toBe('Ethereum')
    })

    it('maps THOR to THORChain', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['THOR']).toBe('THORChain')
    })

    it('maps MAYA to MayaChain', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['MAYA']).toBe('MayaChain')
    })

    it('maps BSC to BSC', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['BSC']).toBe('BSC')
    })

    it('maps AVAX to Avalanche', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['AVAX']).toBe('Avalanche')
    })

    it('maps GAIA to Cosmos', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['GAIA']).toBe('Cosmos')
    })

    it('maps DOGE to Dogecoin', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['DOGE']).toBe('Dogecoin')
    })

    it('maps LTC to Litecoin', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['LTC']).toBe('Litecoin')
    })

    it('maps BCH to Bitcoin-Cash', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['BCH']).toBe('Bitcoin-Cash')
    })

    it('maps ARB to Arbitrum', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['ARB']).toBe('Arbitrum')
    })

    it('maps BASE to Base', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['BASE']).toBe('Base')
    })

    it('maps DASH to Dash', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['DASH']).toBe('Dash')
    })

    it('maps XRP to Ripple', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['XRP']).toBe('Ripple')
    })

    it('maps SOL to Solana', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['SOL']).toBe('Solana')
    })

    it('maps ZEC to Zcash', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['ZEC']).toBe('Zcash')
    })

    it('maps ADA to Cardano', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['ADA']).toBe('Cardano')
    })

    it('maps TRON to Tron', () => {
      expect(ASGARDEX_TO_SDK_CHAIN['TRON']).toBe('Tron')
    })

    it.skip('maps XRD to Radix', () => {
      // XRD/Radix temporarily removed from ASGARDEX_TO_SDK_CHAIN — re-enable when Radix is re-added
      expect(ASGARDEX_TO_SDK_CHAIN['XRD']).toBe('Radix')
    })
  })

  describe('SDK_TO_ASGARDEX_CHAIN', () => {
    it('contains a key for every SDK chain value', () => {
      const sdkChains = Object.values(ASGARDEX_TO_SDK_CHAIN)
      for (const sdk of sdkChains) {
        expect(SDK_TO_ASGARDEX_CHAIN).toHaveProperty(sdk)
      }
    })

    it('contains a value for every Asgardex chain key', () => {
      const asgardexChains = Object.keys(ASGARDEX_TO_SDK_CHAIN)
      const reverseValues = Object.values(SDK_TO_ASGARDEX_CHAIN)
      for (const chain of asgardexChains) {
        expect(reverseValues).toContain(chain)
      }
    })

    it('is bidirectionally consistent (A -> B -> A)', () => {
      for (const [asgardex, sdk] of Object.entries(ASGARDEX_TO_SDK_CHAIN)) {
        expect(SDK_TO_ASGARDEX_CHAIN[sdk]).toBe(asgardex)
      }
    })

    it('has the same number of entries as ASGARDEX_TO_SDK_CHAIN', () => {
      expect(Object.keys(SDK_TO_ASGARDEX_CHAIN)).toHaveLength(Object.keys(ASGARDEX_TO_SDK_CHAIN).length)
    })
  })

  describe('MpcIPCMessages', () => {
    it('has all unique values (no accidental duplicates)', () => {
      const values = Object.values(MpcIPCMessages)
      const uniqueValues = new Set(values)
      expect(uniqueValues.size).toBe(values.length)
    })

    it('contains MPC_INIT', () => {
      expect(MpcIPCMessages.MPC_INIT).toBe('mpc:init')
    })

    it('contains MPC_LIST_VAULTS', () => {
      expect(MpcIPCMessages.MPC_LIST_VAULTS).toBe('mpc:listVaults')
    })

    it('contains MPC_SIGN_BYTES', () => {
      expect(MpcIPCMessages.MPC_SIGN_BYTES).toBe('mpc:signBytes')
    })

    it('contains MPC_SEND_TX', () => {
      expect(MpcIPCMessages.MPC_SEND_TX).toBe('mpc:sendTransaction')
    })

    it('contains MPC_CREATE_FAST_VAULT', () => {
      expect(MpcIPCMessages.MPC_CREATE_FAST_VAULT).toBe('mpc:createFastVault')
    })

    it('contains MPC_CREATE_SECURE_VAULT', () => {
      expect(MpcIPCMessages.MPC_CREATE_SECURE_VAULT).toBe('mpc:createSecureVault')
    })

    it('contains MPC_GET_ADDRESSES', () => {
      expect(MpcIPCMessages.MPC_GET_ADDRESSES).toBe('mpc:getAddresses')
    })

    it('contains MPC_IMPORT_VAULT', () => {
      expect(MpcIPCMessages.MPC_IMPORT_VAULT).toBe('mpc:importVault')
    })

    it('contains MPC_EXPORT_VAULT', () => {
      expect(MpcIPCMessages.MPC_EXPORT_VAULT).toBe('mpc:exportVault')
    })

    it('contains MPC_LOCK_VAULT', () => {
      expect(MpcIPCMessages.MPC_LOCK_VAULT).toBe('mpc:lockVault')
    })

    it('contains MPC_UNLOCK_VAULT', () => {
      expect(MpcIPCMessages.MPC_UNLOCK_VAULT).toBe('mpc:unlockVault')
    })

    it('contains MPC_CANCEL_SIGNING', () => {
      expect(MpcIPCMessages.MPC_CANCEL_SIGNING).toBe('mpc:cancelSigning')
    })

    it('contains event messages for creation progress', () => {
      expect(MpcIPCMessages.MPC_CREATION_PROGRESS).toBe('mpc:creationProgress')
      expect(MpcIPCMessages.MPC_SECURE_VAULT_QR_READY).toBe('mpc:secureVaultQrReady')
      expect(MpcIPCMessages.MPC_DEVICE_JOINED).toBe('mpc:deviceJoined')
    })

    it('contains event messages for signing', () => {
      expect(MpcIPCMessages.MPC_SIGN_QR_READY).toBe('mpc:signQrReady')
      expect(MpcIPCMessages.MPC_SIGN_DEVICE_JOINED).toBe('mpc:signDeviceJoined')
      expect(MpcIPCMessages.MPC_SIGN_PROGRESS).toBe('mpc:signProgress')
    })
  })
})
