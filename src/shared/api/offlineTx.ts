import { Network } from '@xchainjs/xchain-client'
import { Asset, Chain } from '@xchainjs/xchain-util'
import { BaseAmount } from '@xchainjs/xchain-util'

/**
 * Wallet mode for offline signing
 */
export enum WalletMode {
  ONLINE_WATCH_ONLY = 'ONLINE_WATCH_ONLY', // Has public keys only
  OFFLINE_SIGNER = 'OFFLINE_SIGNER', // Has private keys
  NORMAL = 'NORMAL' // Standard mode with full functionality
}

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
 * Offline transaction bundle format
 * This structure contains all data needed for offline signing
 */
export interface OfflineTxBundle {
  version: string
  chain: Chain
  network: Network
  timestamp: number
  expiresAt: number // Transaction expiry time
  metadata: {
    sender: string
    recipient: string
    amount: BaseAmount
    asset: Asset
    memo?: string
    estimatedFee: BaseAmount
  }
  // The unsigned transaction data - format varies by chain
  unsignedTxData: {
    // For UTXO chains: unsigned PSBT or raw tx
    // For Cosmos chains: unsigned tx JSON
    // For EVM chains: unsigned tx object
    rawTx: string // Base64 encoded
    txType: 'cosmos' | 'utxo' | 'evm' | 'other'
    // Additional data needed for signing
    accountNumber?: number // For Cosmos chains
    sequence?: number // For Cosmos chains
    chainId?: string // For EVM/Cosmos chains
    gasLimit?: string // For EVM chains
    gasPrice?: string // For EVM chains
  }
  checksum?: string // SHA256 hash for integrity
}

/**
 * Signed transaction bundle
 * Contains the original bundle plus the signed transaction
 */
export interface SignedTxBundle extends OfflineTxBundle {
  signedTx: string // Base64 encoded signed transaction
  signedAt: number
  signerAddress?: string // For verification
}

/**
 * File format for USB transfer
 */
export interface TxFileFormat {
  type: 'ASGARDEX_UNSIGNED_TX' | 'ASGARDEX_SIGNED_TX' | 'ASGARDEX_WATCH_WALLET'
  version: string
  data: OfflineTxBundle | SignedTxBundle | WatchOnlyWallet[]
}

/**
 * Offline signing status
 */
export enum OfflineSigningStatus {
  PREPARING = 'PREPARING',
  READY_FOR_EXPORT = 'READY_FOR_EXPORT',
  EXPORTED = 'EXPORTED',
  SIGNING = 'SIGNING',
  SIGNED = 'SIGNED',
  BROADCASTING = 'BROADCASTING',
  BROADCAST_SUCCESS = 'BROADCAST_SUCCESS',
  ERROR = 'ERROR'
}

/**
 * Error types specific to offline signing
 */
export enum OfflineSigningError {
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  EXPIRED_TRANSACTION = 'EXPIRED_TRANSACTION',
  NETWORK_MISMATCH = 'NETWORK_MISMATCH',
  CHAIN_MISMATCH = 'CHAIN_MISMATCH',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  SIGNING_FAILED = 'SIGNING_FAILED',
  BROADCAST_FAILED = 'BROADCAST_FAILED',
  NO_WATCH_WALLET = 'NO_WATCH_WALLET',
  PRIVATE_KEY_REQUIRED = 'PRIVATE_KEY_REQUIRED'
}
