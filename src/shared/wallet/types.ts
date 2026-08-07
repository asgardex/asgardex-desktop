import { Address, Chain } from '@xchainjs/xchain-util'

import { EvmHDMode } from '../evm/types'
import { UtxoHDMode } from '../utxo/types'

export enum WalletType {
  Keystore = 'keystore',
  Ledger = 'ledger',
  Vultisig = 'vultisig'
}

export type WalletBalanceType = 'all' | 'confirmed'

export type HDMode = 'default' | EvmHDMode | UtxoHDMode

export type WalletAddress = {
  address: Address
  type: WalletType
  chain: Chain
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}
export type WalletAddresses = WalletAddress[]

/**
 * User-selected HD derivation for a keystore chain, mirroring the fields Ledger
 * already exposes. When `customPath` is set (expert mode) it overrides
 * hdMode/account/index and is used as the client's derivation-path prefix.
 */
export type KeystoreChainHDSettings = {
  hdMode: HDMode
  account: number
  index: number
  customPath?: string
}

/**
 * Keystore HD settings scoped by keystore id → chain. Missing entries fall back
 * to `DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS`, so existing keystores that never touch
 * the setting keep deriving the exact same (account 0 / index 0 / default)
 * address as before. Keys are `String(keystoreId)` and the chain string.
 */
export type KeystoreHDSettingsByChain = Partial<Record<string, KeystoreChainHDSettings>>
export type KeystoreHDSettingsRecord = Partial<Record<string, KeystoreHDSettingsByChain>>

export const DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS: KeystoreChainHDSettings = {
  hdMode: 'default',
  account: 0,
  index: 0
}
