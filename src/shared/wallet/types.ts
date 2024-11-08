import { Address, Chain } from '@xchainjs/xchain-util'

import { EvmHDMode } from '../evm/types'

export enum WalletType {
  Keystore = 'keystore',
  Ledger = 'ledger'
}

export type WalletBalanceType = 'all' | 'confirmed'

export type HDMode = 'default' | EvmHDMode

export type WalletAddress = {
  address: Address
  type: WalletType
  chain: Chain
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}
export type WalletAddresses = WalletAddress[]
