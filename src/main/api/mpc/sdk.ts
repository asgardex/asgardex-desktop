/**
 * Vultisig SDK Singleton
 *
 * SDK runs in Main Process ONLY - never import in renderer.
 * Native/default: FileStorage at ~/.vultisig.
 * Flatpak: FileStorage at VULTISIG_DIR (APP_DATA_DIR/vultisig) so the store is
 * sandbox-writable; host ~/.vultisig is only used as a RO migration source.
 */

import type { Vultisig } from '@vultisig/sdk'
import log from 'electron-log'

import { VULTISIG_DIR } from '../const'

let sdkInstance: Vultisig | null = null
let initPromise: Promise<Vultisig> | null = null
let _disposing = false

// Password cache TTL (5 minutes)
const PASSWORD_CACHE_TTL = 5 * 60 * 1000

const isFlatpak = (): boolean => Boolean(process.env.FLATPAK_ID)

/**
 * Runtime FileStorage ctor — exported by node/electron builds of the SDK but
 * omitted from the default package `index.d.ts` (browser-oriented types).
 */
type FileStorageCtor = new (config?: { basePath?: string }) => unknown

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

    const sdkMod = await import('@vultisig/sdk')
    const { Vultisig } = sdkMod
    // node/electron runtime exports FileStorage; default d.ts does not.
    const FileStorage = (sdkMod as typeof sdkMod & { FileStorage?: FileStorageCtor }).FileStorage

    // Password handling is done via direct unlockVault() calls from UI.
    // onPasswordRequired must be provided or the SDK silently drops encrypted
    // vaults from listVaults(). The callback only needs to EXIST for listVaults
    // to enumerate them; it only FIRES on cache miss, which our flow
    // (unlockVault → passwordCache → operations) avoids.
    //
    // Flatpak: do not use default ~/.vultisig (host path is RO for migration only
    // and is not sandbox-writable). Pin storage under APP_DATA_DIR instead.
    // SDK 2.19.19 does not honor VULTISIG_CONFIG_DIR — pass FileStorage basePath.
    let storage: unknown
    if (isFlatpak()) {
      if (!FileStorage) {
        throw new Error('FileStorage is not available from @vultisig/sdk in this runtime')
      }
      storage = new FileStorage({ basePath: VULTISIG_DIR })
      log.info(`[MPC SDK] Flatpak storage basePath=${VULTISIG_DIR}`)
    }

    const instance = new Vultisig({
      // FileStorage implements Storage at runtime; default d.ts omits the ctor.
      ...(storage ? { storage: storage as never } : {}),
      passwordCache: {
        defaultTTL: PASSWORD_CACHE_TTL
      },
      onPasswordRequired: async (vaultId: string, vaultName: string) => {
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
