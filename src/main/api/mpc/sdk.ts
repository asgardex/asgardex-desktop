/**
 * Vultisig SDK Singleton
 *
 * SDK runs in Main Process ONLY - never import in renderer.
 * Uses FileStorage by default (stores at ~/.vultisig).
 */

import type { Vultisig } from '@vultisig/sdk'
import log from 'electron-log'

let sdkInstance: Vultisig | null = null
let initPromise: Promise<Vultisig> | null = null
let _disposing = false

// Password cache TTL (5 minutes)
const PASSWORD_CACHE_TTL = 5 * 60 * 1000

// Fallback password store — survives SDK internal cache eviction
const _passwordFallback = new Map<string, string>()

/**
 * Initialize the Vultisig SDK
 * Must be called before any other SDK operations.
 */
export async function initializeSDK(): Promise<Vultisig> {
  if (sdkInstance) {
    log.debug('[MPC SDK] Already initialized')
    return sdkInstance
  }

  // If another caller is already initializing, wait on the same promise
  if (initPromise) {
    log.debug('[MPC SDK] Init already in progress, waiting...')
    return initPromise
  }

  _disposing = false

  initPromise = (async () => {
    log.info('[MPC SDK] Initializing...')

    const { Vultisig } = await import('@vultisig/sdk')

    // SDK uses FileStorage by default in Electron (stores at ~/.vultisig)
    // Password handling is done via direct unlockVault() calls from UI.
    // onPasswordRequired must be provided or the SDK silently drops encrypted
    // vaults from listVaults(). The callback only needs to EXIST for listVaults
    // to enumerate them; it only FIRES on cache miss, which our flow
    // (unlockVault → passwordCache → operations) avoids.
    const instance = new Vultisig({
      passwordCache: {
        defaultTTL: PASSWORD_CACHE_TTL
      },
      onPasswordRequired: async (vaultId: string, vaultName: string) => {
        const cached = _passwordFallback.get(vaultId)
        if (cached) {
          log.info(`[MPC SDK] onPasswordRequired fired — returning fallback password for "${vaultName}"`)
          return cached
        }
        const msg = `Password required for vault "${vaultName}" (${vaultId}) — unlock the vault first via apiMpc.unlockVault`
        log.warn(`[MPC SDK] onPasswordRequired fired (cache miss): ${msg}`)
        throw new Error(msg)
      }
    })

    await instance.initialize()

    if (_disposing) {
      log.warn('[MPC SDK] dispose() called during init — discarding stale instance')
      instance.dispose()
      throw new Error('SDK disposed during initialization')
    }

    sdkInstance = instance
    log.info('[MPC SDK] Initialized successfully')
    return sdkInstance
  })()

  try {
    return await initPromise
  } catch (error) {
    // Ensure broken instance is not left behind on failure
    sdkInstance = null
    throw error
  } finally {
    initPromise = null
  }
}

/**
 * Get the initialized SDK instance
 * Throws if SDK is not initialized.
 */
export function getSDK(): Vultisig {
  if (!sdkInstance) {
    throw new Error('MPC SDK not initialized. Call initializeSDK() first.')
  }
  return sdkInstance
}

/**
 * Dispose the SDK instance
 */
/**
 * Store password in fallback cache after successful unlock
 */
export function cachePassword(vaultId: string, password: string): void {
  _passwordFallback.set(vaultId, password)
}

export function disposeSDK(): void {
  _disposing = true
  if (sdkInstance) {
    log.info('[MPC SDK] Disposing...')
    sdkInstance.dispose()
    sdkInstance = null
  }
  initPromise = null
}

/**
 * Check if SDK is initialized
 */
export function isSDKInitialized(): boolean {
  return sdkInstance !== null && sdkInstance.initialized
}
