/**
 * MPC (Vultisig) IPC Handlers
 *
 * Registers IPC handlers for MPC wallet operations.
 * All SDK calls happen in the main process.
 */

import * as path from 'path'

import { dialog, type IpcMain } from 'electron'
import log from 'electron-log'
import * as fs from 'fs-extra'

import {
  ASGARDEX_TO_SDK_CHAIN,
  BalanceResult,
  CreateFastVaultParams,
  CreateSecureVaultParams,
  MpcIPCMessages,
  SerializedVault,
  SignBytesParams
} from '../../../shared/api/mpcTypes'
import { disposeSDK, getSDK, initializeSDK, isSDKInitialized } from './sdk'

// SDK Vault type (minimal interface for what we access)
interface SDKVault {
  id: string
  name: string
  type: 'fast' | 'secure'
  chains?: string[]
  threshold?: number
  signers?: unknown[]
  isEncrypted?: boolean
  signBytes: (options: SignBytesOptions) => Promise<{ signature: string; recovery?: number }>
}

// Sign options for vault.signBytes()
interface SignBytesOptions {
  data: string
  chain: string
  signal?: AbortSignal
  onQRCodeReady?: (qrPayload: string) => void
  onDeviceJoined?: (deviceId: string, totalJoined: number, required: number) => void
  onProgress?: (step: { step: string; message: string; progress: number }) => void
}

/**
 * Serialize a vault object for IPC transfer
 */
function serializeVault(vault: SDKVault): SerializedVault {
  return {
    id: vault.id,
    name: vault.name,
    type: vault.type,
    chains: vault.chains || [],
    threshold: vault.threshold || 2,
    signerCount: vault.signers?.length ?? 0,
    isEncrypted: vault.isEncrypted ?? false
  }
}

/**
 * Register all MPC IPC handlers
 */
export function registerMpcIpcHandlers(ipcMain: IpcMain): void {
  log.info('[MPC IPC] Registering handlers...')

  // ============================================
  // SDK Lifecycle
  // ============================================

  ipcMain.handle(MpcIPCMessages.MPC_INIT, async () => {
    try {
      const sdk = await initializeSDK()
      return { initialized: sdk.initialized }
    } catch (error) {
      log.error('[MPC IPC] Init failed:', error)
      throw error
    }
  })

  ipcMain.handle(MpcIPCMessages.MPC_DISPOSE, async () => {
    disposeSDK()
  })

  ipcMain.handle(MpcIPCMessages.MPC_CANCEL_KEYGEN, async () => {
    // Note: SDK doesn't support abort signals yet, so we dispose the SDK
    // which will clean up resources. User will need to reinitialize to retry.
    log.info('[MPC IPC] Cancelling keygen operation (via dispose)')
    disposeSDK()
  })

  // ============================================
  // Vault Management
  // ============================================

  ipcMain.handle(MpcIPCMessages.MPC_LIST_VAULTS, async () => {
    const sdk = getSDK()
    const vaults = await sdk.listVaults()
    return vaults.map(serializeVault)
  })

  ipcMain.handle(MpcIPCMessages.MPC_CREATE_FAST_VAULT, async (_event, params: CreateFastVaultParams) => {
    const sdk = getSDK()
    log.info(`[MPC IPC] Creating fast vault: ${params.name}`)

    const vaultId = await sdk.createFastVault({
      name: params.name,
      email: params.email,
      password: params.password,
      onProgress: (step) => {
        log.debug(`[MPC IPC] Vault creation progress: ${step}`)
        _event.sender.send(MpcIPCMessages.MPC_CREATION_PROGRESS, { step })
      }
    })

    log.info(`[MPC IPC] Fast vault created, awaiting verification: ${vaultId}`)
    return { vaultId }
  })

  ipcMain.handle(MpcIPCMessages.MPC_CREATE_SECURE_VAULT, async (_event, params: CreateSecureVaultParams) => {
    const sdk = getSDK()
    const { name, password, devices = 2, threshold = 2 } = params
    log.info(`[MPC IPC] Creating secure vault: ${name} (${threshold}-of-${devices})`)

    const { vault } = await sdk.createSecureVault({
      name,
      password: password || '',
      devices,
      threshold,

      onQRCodeReady: (qrPayload: string) => {
        log.info(`[MPC IPC] QR code ready for secure vault`)
        _event.sender.send(MpcIPCMessages.MPC_SECURE_VAULT_QR_READY, qrPayload)
      },

      onDeviceJoined: (deviceId: string, totalJoined: number, required: number) => {
        log.info(`[MPC IPC] Device joined: ${deviceId} (${totalJoined}/${required})`)
        _event.sender.send(MpcIPCMessages.MPC_DEVICE_JOINED, { deviceId, totalJoined, required })
      },

      onProgress: (step: { step: string; message: string; progress: number }) => {
        log.debug(`[MPC IPC] Secure vault progress: ${step.step} - ${step.message} (${step.progress}%)`)
        _event.sender.send(MpcIPCMessages.MPC_CREATION_PROGRESS, step)
      }
    })

    log.info(`[MPC IPC] Secure vault created: ${vault.name} (${vault.id})`)
    return serializeVault(vault)
  })

  ipcMain.handle(MpcIPCMessages.MPC_VERIFY_VAULT, async (_event, vaultId: string, code: string) => {
    const sdk = getSDK()
    log.info(`[MPC IPC] Verifying vault: ${vaultId}`)

    const vault = await sdk.verifyVault(vaultId, code)
    log.info(`[MPC IPC] Vault verified: ${vault.name}`)

    return serializeVault(vault)
  })

  ipcMain.handle(MpcIPCMessages.MPC_DELETE_VAULT, async (_event, vaultId: string) => {
    const sdk = getSDK()
    const vault = await sdk.getVaultById(vaultId)
    if (vault) {
      log.info(`[MPC IPC] Deleting vault: ${vaultId}`)
      await sdk.deleteVault(vault)
    }
  })

  ipcMain.handle(MpcIPCMessages.MPC_GET_ADDRESSES, async (_event, vaultId: string) => {
    const sdk = getSDK()
    const vault = await sdk.getVaultById(vaultId)
    if (!vault) throw new Error(`Vault not found: ${vaultId}`)

    // Use batch method instead of manual loop
    try {
      const addresses = await vault.addresses()
      return addresses
    } catch (error) {
      log.warn(`[MPC IPC] Failed to get addresses:`, error)
      return {}
    }
  })

  ipcMain.handle(MpcIPCMessages.MPC_GET_BALANCES, async (_event, vaultId: string) => {
    const sdk = getSDK()
    const vault = await sdk.getVaultById(vaultId)
    if (!vault) throw new Error(`Vault not found: ${vaultId}`)

    // Use batch method instead of manual loop
    try {
      const sdkBalances = await vault.balances()
      const balances: Record<string, BalanceResult> = {}

      for (const [chain, balance] of Object.entries(sdkBalances)) {
        balances[chain] = {
          amount: balance.amount.toString(),
          decimals: balance.decimals,
          symbol: balance.symbol,
          value: balance.value
        }
      }

      return balances
    } catch (error) {
      log.warn(`[MPC IPC] Failed to get balances:`, error)
      return {}
    }
  })

  // ============================================
  // Vault Import/Export
  // ============================================

  ipcMain.handle(MpcIPCMessages.MPC_IMPORT_VAULT, async (_event, vultContent: string, password?: string) => {
    const sdk = getSDK()
    log.info(`[MPC IPC] Importing vault from .vult file`)

    try {
      const vault = await sdk.importVault(vultContent, password)
      log.info(`[MPC IPC] Vault imported: ${vault.name} (${vault.id})`)
      return serializeVault(vault)
    } catch (error) {
      log.error(`[MPC IPC] Failed to import vault:`, error)
      throw error
    }
  })

  ipcMain.handle(MpcIPCMessages.MPC_EXPORT_VAULT, async (_event, vaultId: string, password?: string) => {
    const sdk = getSDK()
    const vault = await sdk.getVaultById(vaultId)
    if (!vault) throw new Error(`Vault not found: ${vaultId}`)

    log.info(`[MPC IPC] Exporting vault: ${vaultId}`)

    try {
      const result = await vault.export(password)
      log.info(`[MPC IPC] Vault exported: ${vault.name} (${result.filename})`)

      // Show save dialog
      const saveResult = await dialog.showSaveDialog({
        title: 'Export Vultisig Vault',
        defaultPath: result.filename,
        filters: [
          { name: 'Vultisig Vault', extensions: ['vult'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (saveResult.canceled || !saveResult.filePath) {
        log.info('[MPC IPC] Export cancelled by user')
        return { saved: false }
      }

      // Write to file (path from Electron save dialog is safe)
      await fs.writeFile(saveResult.filePath, result.data, 'utf-8') // trunk-ignore(eslint/security/detect-non-literal-fs-filename)
      log.info(`[MPC IPC] Vault saved to: ${saveResult.filePath}`)

      return { saved: true, filePath: saveResult.filePath }
    } catch (error) {
      log.error(`[MPC IPC] Failed to export vault:`, error)
      throw error
    }
  })

  ipcMain.handle(MpcIPCMessages.MPC_OPEN_VAULT_FILE, async () => {
    const sdk = getSDK()
    log.info('[MPC IPC] Opening vault file dialog')

    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Vultisig Vault',
        filters: [
          { name: 'Vultisig Vault', extensions: ['vult'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        log.info('[MPC IPC] File dialog canceled')
        return null
      }

      const filePath = result.filePaths[0]
      const filename = path.basename(filePath)
      const content = await fs.readFile(filePath, 'utf-8') // trunk-ignore(eslint/security/detect-non-literal-fs-filename)
      const isEncrypted = sdk.isVaultEncrypted(content)

      log.info(`[MPC IPC] Vault file selected: ${filename}, encrypted: ${isEncrypted}`)
      return { content, filename, isEncrypted }
    } catch (error) {
      log.error('[MPC IPC] Failed to open vault file:', error)
      throw error
    }
  })

  // ============================================
  // Vault Lock/Unlock
  // ============================================

  ipcMain.handle(MpcIPCMessages.MPC_LOCK_VAULT, async (_event, vaultId: string) => {
    const sdk = getSDK()
    const vault = await sdk.getVaultById(vaultId)
    if (!vault) throw new Error(`Vault not found: ${vaultId}`)

    log.info(`[MPC IPC] Locking vault: ${vaultId}`)
    vault.lock() // Synchronous in SDK v0.3.0
  })

  ipcMain.handle(MpcIPCMessages.MPC_UNLOCK_VAULT, async (_event, vaultId: string, password: string) => {
    const sdk = getSDK()
    const vault = await sdk.getVaultById(vaultId)
    if (!vault) throw new Error(`Vault not found: ${vaultId}`)

    log.info(`[MPC IPC] Unlocking vault: ${vaultId}`)
    await vault.unlock(password)
  })

  // ============================================
  // Transaction Signing
  // ============================================

  // Track active signing sessions for cancellation
  const signingControllers = new Map<string, AbortController>()

  ipcMain.handle(MpcIPCMessages.MPC_SIGN_BYTES, async (_event, params: SignBytesParams) => {
    const sdk = getSDK()
    const { vaultId, chain, data } = params

    const vault = await sdk.getVaultById(vaultId)
    if (!vault) throw new Error(`Vault not found: ${vaultId}`)

    // Convert Asgardex chain ID to SDK chain
    const sdkChain = ASGARDEX_TO_SDK_CHAIN[chain]
    if (!sdkChain) throw new Error(`Unsupported chain: ${chain}`)

    log.info(`[MPC IPC] Signing bytes for chain ${chain} (SDK: ${sdkChain})`)

    // Check if this is a secure vault that needs QR coordination
    const isSecureVault = vault.type === 'secure' || (vault.signers && vault.signers.length > 1)

    // Create abort controller for cancellation support
    const controller = new AbortController()
    signingControllers.set(vaultId, controller)

    try {
      // Build sign options with callbacks for secure vault
      const signOptions: SignBytesOptions = {
        data, // Hex string - SDK accepts with or without 0x
        chain: sdkChain,
        signal: controller.signal
      }

      // Add callbacks for secure vault signing (QR coordination)
      if (isSecureVault) {
        signOptions.onQRCodeReady = (qrPayload: string) => {
          log.info(`[MPC IPC] Sign QR code ready`)
          _event.sender.send(MpcIPCMessages.MPC_SIGN_QR_READY, qrPayload)
        }

        signOptions.onDeviceJoined = (deviceId: string, totalJoined: number, required: number) => {
          log.info(`[MPC IPC] Sign device joined: ${deviceId} (${totalJoined}/${required})`)
          _event.sender.send(MpcIPCMessages.MPC_SIGN_DEVICE_JOINED, { deviceId, totalJoined, required })
        }

        signOptions.onProgress = (step: { step: string; message: string; progress: number }) => {
          log.debug(`[MPC IPC] Sign progress: ${step.step} - ${step.message}`)
          _event.sender.send(MpcIPCMessages.MPC_SIGN_PROGRESS, step)
        }
      }

      const signature = await vault.signBytes(signOptions)

      log.info(`[MPC IPC] Signing complete, signature length: ${signature.signature.length}`)
      return {
        signature: signature.signature,
        recovery: signature.recovery
      }
    } catch (error: unknown) {
      const isAbortError = error instanceof Error && error.name === 'AbortError'
      if (isAbortError || controller.signal.aborted) {
        log.warn(`[MPC IPC] Signing cancelled by user`)
        throw new Error('Signing cancelled')
      }
      log.error(`[MPC IPC] Signing failed:`, error)
      throw error
    } finally {
      // Clean up controller
      signingControllers.delete(vaultId)
    }
  })

  // Cancel an active signing session
  ipcMain.handle(MpcIPCMessages.MPC_CANCEL_SIGNING, async (_event, vaultId: string) => {
    const controller = signingControllers.get(vaultId)
    if (controller) {
      log.info(`[MPC IPC] Cancelling signing for vault: ${vaultId}`)
      controller.abort()
      signingControllers.delete(vaultId)
      return { cancelled: true }
    }
    log.warn(`[MPC IPC] No active signing session for vault: ${vaultId}`)
    return { cancelled: false }
  })

  log.info('[MPC IPC] Handlers registered')
}

/**
 * Check if SDK is ready
 */
export { isSDKInitialized }
