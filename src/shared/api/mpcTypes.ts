/**
 * MPC (Vultisig) API Types
 *
 * Shared type definitions for IPC communication between main and renderer processes.
 * These types must be serializable (no BigInt, no functions, no class instances).
 */

// ============================================
// Vault Types
// ============================================

export type VaultType = 'fast' | 'secure'

export type SerializedVault = {
  id: string
  name: string
  type: VaultType
  chains: string[]
  threshold: number
  signerCount: number
  isEncrypted: boolean
}

// IPC-facing subset of SDK VaultImportOptions. `replace-unvalidated` is not exposed.
export type VaultImportOptions = {
  conflictResolution?: 'replace'
}

export type ImportVaultResult =
  | { ok: true; vault: SerializedVault }
  | { ok: false; code: 'DUPLICATE_VAULT' }
  | { ok: false; code: 'EXISTING_VAULT_PASSWORD_REQUIRED'; vaultId?: string }

// ============================================
// Request/Response Types
// ============================================

export type CreateFastVaultParams = {
  name: string
  email: string
  password: string
}

export type CreateFastVaultResult = {
  vaultId: string
}

export type CreateSecureVaultParams = {
  name: string
  password?: string
  devices?: number // default 2
  threshold?: number // default 2
}

export type DeviceJoinedData = {
  deviceId: string
  totalJoined: number
  required: number
}

export type CreationProgressData = {
  step: string
  message?: string
  progress?: number
}

export type VerifyVaultResult = SerializedVault

export type GetAddressesResult = Record<string, string>

export type BalanceResult = {
  amount: string
  decimals: number
  symbol: string
  value?: number
}

export type GetBalancesResult = Record<string, BalanceResult>

// ============================================
// Transaction Signing Types
// ============================================

export type SignBytesParams = {
  vaultId: string
  chain: string // Asgardex chain ID (BTC, ETH, THOR, etc.)
  data: string // Hex-encoded hash to sign (with or without 0x)
}

export type SignBytesResult = {
  signature: string // Hex-encoded signature (r || s)
  recovery?: number // ECDSA recovery byte (0 or 1), undefined for EdDSA
}

export type SignProgressData = {
  step: string
  message?: string
  progress?: number // 0-100
}

// ============================================
// SDK Native Transaction Pipeline Types
// ============================================

/**
 * Parameters for the native SDK sendTransaction pipeline.
 * Runs entirely in main process: prepareSendTx → extractMessageHashes → sign → broadcastTx
 */
export type SendTransactionParams = {
  vaultId: string
  chain: string // Asgardex chain ID (BTC, ETH, THOR, etc.)
  receiver: string
  amount: string // Base amount as string (BigInt serialization)
  memo?: string
  decimals: number // Native asset decimals (e.g., 18 for ETH, 8 for BTC)
  ticker: string // Native asset ticker (e.g., 'ETH', 'BTC')
  id?: string // Token identifier: denom (Cosmos), contract address (EVM), mint (Solana). Omit for native coins.
  approve?: { spender: string; amount: string } // ERC20 approve: SDK sets erc20ApprovePayload on keysign payload
  isDeposit?: boolean // Native chain deposit (MsgDeposit for THOR/MAYA). Receiver is ignored; uses sender as signer.
}

export type SendTransactionResult = {
  txHash: string
}

// ============================================
// Vault Import/Export Types
// ============================================

export type ImportVaultParams = {
  vultContent: string
  password?: string
}

export type ExportVaultParams = {
  vaultId: string
  password?: string
}

export type OpenVaultFileResult = {
  content: string
  filename: string
  isEncrypted: boolean
} | null

// ============================================
// Chain Mapping (Asgardex Chain ID -> SDK Chain)
// ============================================

export const ASGARDEX_TO_SDK_CHAIN: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  THOR: 'THORChain',
  MAYA: 'MayaChain',
  BSC: 'BSC',
  AVAX: 'Avalanche',
  GAIA: 'Cosmos',
  DOGE: 'Dogecoin',
  LTC: 'Litecoin',
  BCH: 'Bitcoin-Cash',
  ARB: 'Arbitrum',
  BASE: 'Base',
  DASH: 'Dash',
  XRP: 'Ripple',
  SOL: 'Solana',
  ZEC: 'Zcash',
  ADA: 'Cardano',
  TRON: 'Tron'
  // XRD (Radix) is not supported by ASGARDEX and will not be added.
}

export const SDK_TO_ASGARDEX_CHAIN: Record<string, string> = Object.entries(ASGARDEX_TO_SDK_CHAIN).reduce(
  (acc, [asgardex, sdk]) => {
    acc[sdk] = asgardex
    return acc
  },
  {} as Record<string, string>
)

// ============================================
// IPC Message Types
// ============================================

export enum MpcIPCMessages {
  // SDK Lifecycle
  MPC_INIT = 'mpc:init',
  MPC_DISPOSE = 'mpc:dispose',
  MPC_CANCEL_KEYGEN = 'mpc:cancelKeygen',

  // Vault Management
  MPC_LIST_VAULTS = 'mpc:listVaults',
  MPC_CREATE_FAST_VAULT = 'mpc:createFastVault',
  MPC_CREATE_SECURE_VAULT = 'mpc:createSecureVault',
  MPC_VERIFY_VAULT = 'mpc:verifyVault',
  MPC_DELETE_VAULT = 'mpc:deleteVault',
  MPC_RENAME_VAULT = 'mpc:renameVault',
  MPC_GET_ADDRESSES = 'mpc:getAddresses',
  MPC_GET_BALANCES = 'mpc:getBalances',

  // Vault Import/Export
  MPC_IMPORT_VAULT = 'mpc:importVault',
  MPC_EXPORT_VAULT = 'mpc:exportVault',
  MPC_OPEN_VAULT_FILE = 'mpc:openVaultFile',

  // Vault Lock/Unlock
  MPC_LOCK_VAULT = 'mpc:lockVault',
  MPC_UNLOCK_VAULT = 'mpc:unlockVault',
  MPC_IS_VAULT_UNLOCKED = 'mpc:isVaultUnlocked',

  // Events (main -> renderer)
  MPC_CREATION_PROGRESS = 'mpc:creationProgress',
  MPC_SECURE_VAULT_QR_READY = 'mpc:secureVaultQrReady',
  MPC_DEVICE_JOINED = 'mpc:deviceJoined',

  // Transaction Signing
  MPC_SIGN_BYTES = 'mpc:signBytes',
  MPC_SEND_TX = 'mpc:sendTransaction',
  MPC_CANCEL_SIGNING = 'mpc:cancelSigning',

  // Signing Events (main -> renderer, SecureVault only)
  MPC_SIGN_QR_READY = 'mpc:signQrReady',
  MPC_SIGN_DEVICE_JOINED = 'mpc:signDeviceJoined',
  MPC_SIGN_PROGRESS = 'mpc:signProgress'
}

// ============================================
// API Interface (exposed on window.apiMpc)
// ============================================

export type CreationProgressCallback = (data: CreationProgressData) => void
export type QRCodeReadyCallback = (qrPayload: string) => void
export type DeviceJoinedCallback = (data: DeviceJoinedData) => void

// Signing event callbacks
export type SignQRCodeReadyCallback = (qrPayload: string) => void
export type SignDeviceJoinedCallback = (data: DeviceJoinedData) => void
export type SignProgressCallback = (data: SignProgressData) => void

export type ApiMpc = {
  // SDK Lifecycle
  init: () => Promise<{ initialized: boolean }>
  dispose: () => Promise<void>
  cancelKeygen: () => Promise<void>

  // Vault Management
  listVaults: () => Promise<SerializedVault[]>
  createFastVault: (params: CreateFastVaultParams) => Promise<CreateFastVaultResult>
  createSecureVault: (params: CreateSecureVaultParams) => Promise<SerializedVault>
  verifyVault: (vaultId: string, code: string) => Promise<VerifyVaultResult>
  deleteVault: (vaultId: string) => Promise<void>
  renameVault: (vaultId: string, newName: string) => Promise<void>
  getAddresses: (vaultId: string) => Promise<GetAddressesResult>
  getBalances: (vaultId: string) => Promise<GetBalancesResult>

  // Vault Import/Export
  importVault: (vultContent: string, password?: string, options?: VaultImportOptions) => Promise<ImportVaultResult>
  exportVault: (vaultId: string, password?: string) => Promise<{ saved: boolean; filePath?: string }>
  openVaultFile: () => Promise<OpenVaultFileResult>

  // Vault Lock/Unlock
  lockVault: (vaultId: string) => Promise<void>
  unlockVault: (vaultId: string, password: string) => Promise<void>
  // Whether the vault's password is currently cached & not expired (i.e. it can
  // sign without a fresh password prompt). Reflects the SDK's password-cache TTL.
  isVaultUnlocked: (vaultId: string) => Promise<boolean>

  // Transaction Signing
  signBytes: (params: SignBytesParams) => Promise<SignBytesResult>
  sendTransaction: (params: SendTransactionParams) => Promise<SendTransactionResult>
  cancelSigning: (vaultId: string) => Promise<{ cancelled: boolean }>

  // Event Listeners (return cleanup function)
  onCreationProgress: (callback: CreationProgressCallback) => () => void
  onQRCodeReady: (callback: QRCodeReadyCallback) => () => void
  onDeviceJoined: (callback: DeviceJoinedCallback) => () => void

  // Signing Event Listeners (return cleanup function)
  onSignQRReady: (callback: SignQRCodeReadyCallback) => () => void
  onSignDeviceJoined: (callback: SignDeviceJoinedCallback) => () => void
  onSignProgress: (callback: SignProgressCallback) => () => void
}

// ============================================
// Extend Window interface
// ============================================

declare global {
  interface Window {
    apiMpc: ApiMpc
  }
}
