import { THORChain } from '@xchainjs/xchain-thorchain'
import { baseAmount } from '@xchainjs/xchain-util'

import { AssetRuneNative } from '../../../shared/utils/asset'
import { WalletAddress, WalletType } from '../../../shared/wallet/types'
import { WalletBalance } from '../../services/wallet/types'

/**
 * Helper to create mock instances of `WalletBalances`
 *
 * It returns following `WalletBalances` by default
 * ```ts
 *  {
 *    walletType: 'keystore',
 *    amount: baseAmount(1),
 *    asset: AssetRuneNative,
 *    walletAddress: 'wallet-address'
 *    walletIndex: 0
 * }
 * ```
 * Pass any values you want to override
 */
export const mockWalletBalance = (overrides?: Partial<WalletBalance>): WalletBalance => ({
  walletType: WalletType.Keystore,
  amount: baseAmount(1),
  asset: AssetRuneNative,
  walletAddress: 'wallet-address',
  walletAccount: 0,
  walletIndex: 0,
  hdMode: 'default',
  ...overrides
})

/**
 * Helper to create mock instances of `WalletAddress`
 *
 * It returns following `WalletAddress` by default
 * ```ts
 *  {
 *    address: 'wallet-address'
 *    type: 'keystore',
 *    chain: THORChain,
 *    walletIndex: 0
 * }
 * ```
 * Pass any values you want to override
 */
export const mockWalletAddress = (overrides?: Partial<WalletAddress>): WalletAddress => ({
  address: 'wallet-address',
  type: WalletType.Keystore,
  chain: THORChain,
  walletAccount: 0,
  walletIndex: 0,
  hdMode: 'default',
  ...overrides
})
