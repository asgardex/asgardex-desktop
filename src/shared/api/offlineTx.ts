import { Chain } from '@xchainjs/xchain-util'

/**
 * Watch-only wallet data
 * This is what the online computer stores - public keys only
 */
export interface WatchOnlyWallet {
  address: string
  publicKey?: string // Optional, some chains don't need it
  chain: Chain
  walletIndex: number
  hdPath?: string
}

/**
 * File format for USB transfer
 */
export interface TxFileFormat {
  type: 'ASGARDEX_WATCH_WALLET'
  version: string
  data: WatchOnlyWallet[]
}
