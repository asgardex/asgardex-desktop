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
  SendTransactionParams,
  SerializedVault,
  SignBytesParams
} from '../../../shared/api/mpcTypes'
import { disposeSDK, getSDK, initializeSDK, isSDKInitialized } from './sdk'

// SDK Vault type (minimal interface for what we access)
// Keep this minimal — only the properties used by serializeVault and signBytes.
// The sendTransaction handler uses `as any` for SDK-native pipeline methods
// because their types (KeysignPayload, Chain, Signature) are complex SDK internals.
interface SDKVault {
  id: string
  name: string
  type: 'fast' | 'secure'
  chains?: string[]
  threshold?: number
  signers?: unknown[]
  isEncrypted?: boolean
  rename: (newName: string) => Promise<void>
  address: (chain: string) => Promise<string>
  signBytes: (
    options: SDKSignBytesOptions,
    signingOptions?: SDKSigningOptions
  ) => Promise<{ signature: string; recovery?: number }>
}

// First argument to vault.signBytes() - just data and chain
interface SDKSignBytesOptions {
  data: string
  chain: string
}

// Second argument to vault.signBytes() - signal and callbacks
// Note: onQRCodeReady and onDeviceJoined only apply to SecureVault.
interface SDKSigningOptions {
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

  ipcMain.handle(MpcIPCMessages.MPC_RENAME_VAULT, async (_event, vaultId: string, newName: string) => {
    // Sanitize input: trim, enforce max length, reject control characters
    const sanitized = newName
      .trim()
      .slice(0, 50)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f]/g, '')
    if (!sanitized) throw new Error('Vault name cannot be empty')

    const sdk = getSDK()
    const vault = await sdk.getVaultById(vaultId)
    if (!vault) throw new Error(`Vault not found: ${vaultId}`)

    log.info(`[MPC IPC] Renaming vault ${vaultId} to: ${sanitized}`)
    await vault.rename(sanitized)
    log.info(`[MPC IPC] Vault renamed successfully: ${sanitized}`)
  })

  ipcMain.handle(MpcIPCMessages.MPC_GET_ADDRESSES, async (_event, vaultId: string) => {
    const sdk = getSDK()
    const vault = await sdk.getVaultById(vaultId)
    if (!vault) throw new Error(`Vault not found: ${vaultId}`)

    // Derive addresses for all supported chains using vault.address(chain)
    // This ensures all Asgardex-supported chains get addresses, not just the SDK default set
    const addresses: Record<string, string> = {}
    const sdkChains = Object.values(ASGARDEX_TO_SDK_CHAIN)

    for (const sdkChain of sdkChains) {
      try {
        const address = await vault.address(sdkChain)
        if (address) {
          addresses[sdkChain] = address
        }
      } catch (error) {
        log.warn(`[MPC IPC] Failed to get address for chain ${sdkChain}:`, error)
        // Continue with other chains
      }
    }

    log.info(`[MPC IPC] Derived addresses for ${Object.keys(addresses).length} chains`)
    return addresses
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

    // Check if this is a secure vault that needs QR coordination
    const isSecureVault = vault.type === 'secure' || (vault.signers && vault.signers.length > 1)

    log.info(`[MPC IPC] Signing bytes for chain ${chain} (SDK: ${sdkChain})`, {
      vaultId,
      vaultType: vault.type,
      isSecureVault,
      threshold: vault.threshold,
      signerCount: vault.signers?.length ?? 0,
      dataLength: data?.length,
      dataPrefix: data?.slice(0, 16) + '...'
    })

    // Create abort controller for cancellation support
    const controller = new AbortController()
    signingControllers.set(vaultId, controller)

    // Heartbeat timer to log during long MPC ceremony
    let heartbeatCount = 0
    const heartbeat = setInterval(() => {
      heartbeatCount++
      log.info(`[MPC IPC] Signing in progress... (${heartbeatCount * 10}s elapsed)`, {
        chain,
        vaultType: vault.type,
        aborted: controller.signal.aborted
      })
    }, 10000)

    try {
      // First argument: data and chain only
      const signBytesOptions: SDKSignBytesOptions = {
        data, // Hex string - SDK accepts with or without 0x
        chain: sdkChain
      }

      // Second argument: signal and callbacks
      // SDK 0.4.x expects callbacks in the SECOND parameter, not the first.
      // For SecureVault: { signal, onQRCodeReady, onDeviceJoined, onProgress }
      // For FastVault:   { signal, onProgress }
      const signingOptions: SDKSigningOptions = {
        signal: controller.signal,
        onProgress: (step) => {
          log.info(`[MPC IPC] Sign progress: ${step.step} - ${step.message} (${step.progress}%)`)
          _event.sender.send(MpcIPCMessages.MPC_SIGN_PROGRESS, step)
        }
      }

      // Add callbacks for secure vault signing (QR coordination)
      if (isSecureVault) {
        signingOptions.onQRCodeReady = (qrPayload: string) => {
          log.info(`[MPC IPC] Sign QR code ready (payload length: ${qrPayload?.length})`)
          _event.sender.send(MpcIPCMessages.MPC_SIGN_QR_READY, qrPayload)
        }

        signingOptions.onDeviceJoined = (deviceId: string, totalJoined: number, required: number) => {
          log.info(`[MPC IPC] Sign device joined: ${deviceId} (${totalJoined}/${required})`)
          _event.sender.send(MpcIPCMessages.MPC_SIGN_DEVICE_JOINED, { deviceId, totalJoined, required })
          if (totalJoined >= required) {
            log.info(`[MPC IPC] All devices joined (${totalJoined}/${required}), MPC ceremony starting...`)
          }
        }
      }

      log.info(`[MPC IPC] Calling vault.signBytes()`, {
        chain: sdkChain,
        isSecureVault,
        hasQRCallback: !!signingOptions.onQRCodeReady,
        hasDeviceCallback: !!signingOptions.onDeviceJoined,
        hasProgressCallback: !!signingOptions.onProgress
      })

      const signature = await vault.signBytes(signBytesOptions, signingOptions)

      log.info(`[MPC IPC] Signing complete`, {
        chain,
        signatureLength: signature.signature.length,
        recovery: signature.recovery,
        signaturePrefix: signature.signature.slice(0, 16) + '...'
      })
      return {
        signature: signature.signature,
        recovery: signature.recovery
      }
    } catch (error: unknown) {
      const isAbortError = error instanceof Error && error.name === 'AbortError'
      if (isAbortError || controller.signal.aborted) {
        log.warn(`[MPC IPC] Signing cancelled by user`, { chain })
        throw new Error('Signing cancelled')
      }
      log.error(`[MPC IPC] Signing failed:`, error)
      throw error
    } finally {
      clearInterval(heartbeat)
      signingControllers.delete(vaultId)
    }
  })

  // ============================================
  // Native SDK Transaction Pipeline
  // ============================================

  ipcMain.handle(MpcIPCMessages.MPC_SEND_TX, async (_event, params: SendTransactionParams) => {
    const sdk = getSDK()
    const { vaultId, chain, receiver, amount, memo, decimals, ticker, id, approve } = params

    const vault = await sdk.getVaultById(vaultId)
    if (!vault) throw new Error(`Vault not found: ${vaultId}`)

    const sdkChain = ASGARDEX_TO_SDK_CHAIN[chain]
    if (!sdkChain) throw new Error(`Unsupported chain: ${chain}`)

    const isSecureVault = vault.type === 'secure' || (vault.signers && vault.signers.length > 1)

    log.info(`[MPC IPC] sendTransaction starting`, {
      chain,
      sdkChain,
      vaultType: vault.type,
      isSecureVault,
      receiver,
      amount,
      decimals,
      ticker,
      memo: memo || '(none)'
    })

    // Create abort controller for cancellation
    const controller = new AbortController()
    signingControllers.set(vaultId, controller)

    // Heartbeat timer for long MPC ceremonies
    let heartbeatCount = 0
    const heartbeat = setInterval(() => {
      heartbeatCount++
      log.info(`[MPC IPC] sendTransaction in progress... (${heartbeatCount * 10}s elapsed)`, { chain })
    }, 10000)

    // Cast to any for SDK-native pipeline methods (prepareSendTx, extractMessageHashes, sign, broadcastTx).
    // These methods exist on the real VaultBase but aren't in our minimal SDKVault interface
    // because their parameter types (KeysignPayload, Chain, Signature) are complex SDK internals.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkVault = vault as any

    try {
      // Step 1: Get sender address from vault
      const senderAddress: string = await sdkVault.address(sdkChain)
      log.info(`[MPC IPC] Step 1: sender address`, { chain, senderAddress })

      // Step 2: Build AccountCoin for SDK
      const coin = {
        chain: sdkChain,
        address: senderAddress,
        decimals,
        ticker,
        ...(id ? { id } : {})
      }

      // ERC20 approve: ABI-encode calldata and put in memo as native coin contract call.
      const isApprove = !!approve
      let txMemo = memo
      if (isApprove) {
        const selector = '095ea7b3'
        const paddedSpender = approve.spender.replace('0x', '').toLowerCase().padStart(64, '0')
        const amountHex = BigInt(approve.amount).toString(16).padStart(64, '0')
        txMemo = `0x${selector}${paddedSpender}${amountHex}`
        delete coin.id // Must be native for EVM resolver to use memo as tx data
        log.info(`[MPC IPC] Approve mode: ABI calldata in memo`, {
          spender: approve.spender,
          calldataLength: txMemo.length
        })
      }

      // Zero-amount native contract calls (ERC20 approve, ERC20 pool tx via depositWithExpiry)
      // fail refineKeysignAmount because it rejects amount <= 0 for native/fee coins.
      // Workaround: pass amount=1 to survive validation, then override toAmount="0" after.
      let txAmount = BigInt(amount)
      const isZeroAmountContractCall = txAmount === 0n && !coin.id && txMemo?.startsWith('0x')
      if (isZeroAmountContractCall) {
        txAmount = 1n
        log.info(`[MPC IPC] Zero-amount contract call: using amount=1 to pass validation (will override to 0)`)
      }

      // Step 3: Prepare transaction (SDK handles gas, nonce, fees)
      log.info(`[MPC IPC] Step 2: prepareSendTx`, {
        coin,
        receiver,
        amount: String(txAmount),
        memo: txMemo ? `${txMemo.slice(0, 20)}...` : '(none)'
      })
      const keysignPayload = await sdkVault.prepareSendTx({
        coin,
        receiver,
        amount: txAmount,
        memo: txMemo
      })
      log.info(`[MPC IPC] Step 2: prepareSendTx complete`)

      // Restore toAmount to 0 — the 1 wei was only to pass refineKeysignAmount.
      if (isZeroAmountContractCall) {
        keysignPayload.toAmount = '0'
        log.info(`[MPC IPC] Overrode toAmount to "0" (zero-amount contract call)`)
      }

      // Step 4: Extract message hashes
      log.info(`[MPC IPC] Step 3: extractMessageHashes`)
      const messageHashes: string[] = await sdkVault.extractMessageHashes(keysignPayload)
      log.info(`[MPC IPC] Step 3: extractMessageHashes complete`, {
        hashCount: messageHashes.length,
        hashes: messageHashes.map((h: string) => h.slice(0, 16) + '...')
      })

      // Step 5: Sign with full transaction context
      const signingPayload = {
        transaction: keysignPayload,
        chain: sdkChain,
        messageHashes
      }

      const signOptions: Record<string, unknown> = {
        signal: controller.signal
      }

      // Add callbacks for SecureVault (same events as signBytes)
      if (isSecureVault) {
        signOptions.onQRCodeReady = (qrPayload: string) => {
          log.info(`[MPC IPC] sendTx QR code ready (payload length: ${qrPayload?.length})`)
          _event.sender.send(MpcIPCMessages.MPC_SIGN_QR_READY, qrPayload)
        }

        signOptions.onDeviceJoined = (deviceId: string, totalJoined: number, required: number) => {
          log.info(`[MPC IPC] sendTx device joined: ${deviceId} (${totalJoined}/${required})`)
          _event.sender.send(MpcIPCMessages.MPC_SIGN_DEVICE_JOINED, { deviceId, totalJoined, required })
          if (totalJoined >= required) {
            log.info(`[MPC IPC] All devices joined, MPC ceremony starting...`)
          }
        }
      }

      log.info(`[MPC IPC] Step 4: sign (full payload)`, {
        isSecureVault,
        hashCount: messageHashes.length
      })
      const signature = await sdkVault.sign(signingPayload, signOptions)
      log.info(`[MPC IPC] Step 4: sign complete`, {
        signatureLength: signature?.signature?.length,
        format: signature?.format,
        recovery: signature?.recovery
      })

      // Step 6: Broadcast via SDK
      log.info(`[MPC IPC] Step 5: broadcastTx`)
      const txHash: string = await sdkVault.broadcastTx({
        chain: sdkChain,
        keysignPayload,
        signature
      })
      log.info(`[MPC IPC] Step 5: broadcastTx complete`, { txHash })

      return { txHash }
    } catch (error: unknown) {
      const isAbortError = error instanceof Error && error.name === 'AbortError'
      if (isAbortError || controller.signal.aborted) {
        log.warn(`[MPC IPC] sendTransaction cancelled by user`, { chain })
        throw new Error('Signing cancelled')
      }
      log.error(`[MPC IPC] sendTransaction failed:`, error)
      throw error
    } finally {
      clearInterval(heartbeat)
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
