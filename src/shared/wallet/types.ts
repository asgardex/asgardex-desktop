import { Address, Chain } from '@xchainjs/xchain-util'

import { EvmHDMode } from '../evm/types'

export type WalletType = 'keystore' | 'ledger'

export type WalletBalanceType = 'all' | 'confirmed'

export type HDMode = 'default' | EvmHDMode

export type WalletAddress = { address: Address; type: WalletType; chain: Chain; walletIndex: number; hdMode: HDMode }
export type WalletAddresses = WalletAddress[]
