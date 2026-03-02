/**
 * Vault Manager Service
 *
 * Manages Vultisig MPC vault lifecycle:
 * - SDK initialization and vault listing
 * - Vault selection, creation, deletion
 * - Password lock/unlock
 * - State management for Vultisig mode
 *
 * All SDK calls go through window.apiMpc (IPC to main process).
 *
 * NOTE: Transaction signing is NOT handled here.
 * Sign transactions via unified wallet flow (Phase 5B-C):
 *   prepareTx() → signBytes() → broadcastTx()
 */

import * as O from 'fp-ts/Option'
import { timer } from 'rxjs'

import { LastOpenedWallet } from '../../../shared/api/types'
import { WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import { getStorageState } from '../storage/common'
import { VaultManager, VultisigState, VultisigVaultInfo, CreateFastVaultParams } from './types'

/** Callback type for saving the last opened wallet to persistent storage */
type SaveWalletCallback = (wallet: LastOpenedWallet | undefined) => void

const INITIAL_VULTISIG_STATE: VultisigState = {
  mode: 'standalone-vultisig',
  phase: 'vault-selection',
  availableVaults: [],
  activeVault: null,
  addresses: {}
}

export const createVaultManager = (onSaveWallet: SaveWalletCallback): VaultManager => {
  const {
    get$: vultisigState$,
    get: vultisigState,
    set: setVultisigState
  } = observableState<VultisigState>(INITIAL_VULTISIG_STATE)

  /**
   * Enter standalone Vultisig mode
   * If already in 'active' phase with a vault, preserves the current state
   * If a saved vault ID exists in storage, tries to restore it
   */
  const enterStandaloneMode = async () => {
    const currentState = vultisigState()

    // If we're already active with a vault, don't reset
    if (currentState.phase === 'active' && currentState.activeVault) {
      window.apiLog.info('[Vultisig]', 'Already in active state, preserving vault')
      return
    }

    setVultisigState({
      ...currentState,
      phase: 'vault-selection'
    })

    // Initialize SDK (idempotent — promise-lock in main process)
    // and load vaults if not already loaded
    try {
      await window.apiMpc.init()
      if (currentState.availableVaults.length === 0) {
        await loadVaults()
      }

      // Try to restore saved vault
      const storageState = getStorageState()
      const savedVaultId =
        O.isSome(storageState) && storageState.value.lastOpenedWallet?.type === WalletType.Vultisig
          ? storageState.value.lastOpenedWallet.vaultId
          : undefined
      if (savedVaultId) {
        const vaults = vultisigState().availableVaults
        const savedVault = vaults.find((v) => v.id === savedVaultId)
        if (savedVault) {
          window.apiLog.info('[Vultisig]', 'Restoring saved vault:', savedVault.name)
          await selectVault(savedVaultId)
        } else {
          window.apiLog.info('[Vultisig]', 'Saved vault not found, clearing storage')
          onSaveWallet(undefined)
        }
      }
    } catch (error) {
      window.apiLog.error('[Vultisig]', 'Failed to initialize:', error)
      setVultisigState((prev) => ({
        ...prev,
        error: String(error)
      }))
    }
  }

  /**
   * Exit standalone Vultisig mode
   * Clears the saved vault ID from storage but preserves vault list
   */
  const exitStandaloneMode = () => {
    onSaveWallet(undefined)
    const currentState = vultisigState()
    // Preserve availableVaults so they're still visible in dropdown
    // Just reset the active state
    setVultisigState({
      ...INITIAL_VULTISIG_STATE,
      availableVaults: currentState.availableVaults
    })
  }

  /**
   * Load available vaults from SDK
   */
  const loadVaults = async () => {
    try {
      const vaults = await window.apiMpc.listVaults()
      const vaultInfos: VultisigVaultInfo[] = vaults.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        isEncrypted: v.isEncrypted,
        chains: v.chains
      }))
      setVultisigState((prev) => ({ ...prev, availableVaults: vaultInfos, error: undefined }))
    } catch (error) {
      window.apiLog.error('[Vultisig]', 'Failed to load vaults:', error)
      setVultisigState((prev) => ({ ...prev, error: String(error) }))
    }
  }

  /**
   * Select a vault
   * If requireUnlock is true (default), sets phase to 'vault-locked' for password entry
   * If requireUnlock is false (newly created vaults), sets phase to 'active' directly
   * Saves the vault ID to persistent storage for restoration
   */
  const selectVault = async (vaultId: string, requireUnlock = true) => {
    window.apiLog.info('[Vultisig]', 'selectVault called:', vaultId, 'requireUnlock:', requireUnlock)
    const currentState = vultisigState()
    window.apiLog.info(
      '[Vultisig]',
      'currentState.phase:',
      currentState.phase,
      'availableVaults:',
      currentState.availableVaults.length
    )
    const vault = currentState.availableVaults.find((v) => v.id === vaultId)

    if (!vault) {
      window.apiLog.warn('[Vultisig]', 'Vault not found:', vaultId)
      setVultisigState((prev) => ({
        ...prev,
        error: 'Vault not found'
      }))
      return
    }

    try {
      // Save active vault ID to storage for restoration on app restart
      onSaveWallet({ type: WalletType.Vultisig, vaultId })

      // Require password unlock (unless this is a newly created/verified vault)
      if (requireUnlock) {
        // Vault needs password - set to locked state
        window.apiLog.info('[Vultisig]', 'Setting vault to locked state:', vault.name)
        setVultisigState((prev) => ({
          ...prev,
          phase: 'vault-locked',
          activeVault: vault,
          addresses: {},
          error: undefined
        }))
        window.apiLog.info('[Vultisig]', 'Vault selected, waiting for password:', vault.name)
        return
      }

      // No unlock required (newly created vault) - get addresses and activate
      const addresses = await window.apiMpc.getAddresses(vaultId)

      setVultisigState((prev) => ({
        ...prev,
        phase: 'active',
        activeVault: vault,
        addresses,
        error: undefined
      }))
      window.apiLog.info('[Vultisig]', 'Vault activated directly:', vault.name)
    } catch (error) {
      window.apiLog.error('[Vultisig]', 'Failed to select vault:', error)
      setVultisigState((prev) => ({
        ...prev,
        error: String(error)
      }))
    }
  }

  /**
   * Create a new fast vault
   */
  const createFastVault = async (params: CreateFastVaultParams): Promise<string> => {
    setVultisigState((prev) => ({
      ...prev,
      phase: 'vault-creation',
      error: undefined
    }))

    // Subscribe to progress events - use functional update to avoid race conditions
    const unsubscribe = window.apiMpc.onCreationProgress((data) => {
      setVultisigState((currentState) => ({
        ...currentState,
        creationProgress: data.step
      }))
    })

    try {
      const result = await window.apiMpc.createFastVault(params)
      unsubscribe()

      setVultisigState((prev) => ({
        ...prev,
        phase: 'verification',
        pendingVaultId: result.vaultId,
        creationProgress: undefined
      }))

      return result.vaultId
    } catch (error) {
      unsubscribe()
      window.apiLog.error('[Vultisig]', 'Failed to create vault:', error)
      setVultisigState((prev) => ({
        ...prev,
        phase: 'vault-selection',
        error: String(error),
        creationProgress: undefined
      }))
      throw error
    }
  }

  /**
   * Verify vault with email code
   * Newly verified vaults are activated directly (user just entered password)
   */
  const verifyVault = async (vaultId: string, code: string) => {
    try {
      const vault = await window.apiMpc.verifyVault(vaultId, code)

      // Reload vaults and select the new one (skip unlock since user just created it)
      await loadVaults()
      await selectVault(vault.id, false) // requireUnlock = false for new vaults
    } catch (error) {
      window.apiLog.error('[Vultisig]', 'Failed to verify vault:', error)
      setVultisigState((prev) => ({
        ...prev,
        error: String(error)
      }))
      throw error
    }
  }

  /**
   * Delete a vault
   * Clears storage if deleting the active vault
   */
  const deleteVault = async (vaultId: string) => {
    try {
      await window.apiMpc.deleteVault(vaultId)

      const currentState = vultisigState()

      // If deleting active vault, reset to selection and clear storage
      if (currentState.activeVault?.id === vaultId) {
        onSaveWallet(undefined)
        setVultisigState((prev) => ({
          ...prev,
          phase: 'vault-selection',
          activeVault: null,
          addresses: {}
        }))
      }

      await loadVaults()
    } catch (error) {
      window.apiLog.error('[Vultisig]', 'Failed to delete vault:', error)
      setVultisigState((prev) => ({
        ...prev,
        error: String(error)
      }))
    }
  }

  /**
   * Rename a vault
   * Updates the name in the SDK and refreshes the vault list
   */
  const renameVault = async (vaultId: string, newName: string) => {
    try {
      await window.apiMpc.renameVault(vaultId, newName)
      await loadVaults() // Refresh vault list

      // If renaming the active vault, update activeVault name in the refreshed state
      setVultisigState((prev) => {
        if (prev.activeVault?.id === vaultId) {
          return { ...prev, activeVault: { ...prev.activeVault, name: newName } }
        }
        return prev
      })

      window.apiLog.info('[Vultisig]', 'Vault renamed:', vaultId, '->', newName)
    } catch (error) {
      window.apiLog.error('[Vultisig]', 'Failed to rename vault:', error)
      setVultisigState((prev) => ({
        ...prev,
        error: String(error)
      }))
      throw error
    }
  }

  /**
   * Export a vault as a .vult file
   * Triggers a "Save As" dialog in the main process
   */
  const exportVault = async (vaultId: string) => {
    try {
      await window.apiMpc.exportVault(vaultId)
      window.apiLog.info('[Vultisig]', 'Vault exported:', vaultId)
    } catch (error) {
      window.apiLog.error('[Vultisig]', 'Failed to export vault:', error)
      throw error
    }
  }

  /**
   * Reset to vault selection phase
   */
  const resetToVaultSelection = () => {
    setVultisigState((prev) => ({
      ...prev,
      phase: 'vault-selection',
      activeVault: null,
      addresses: {},
      pendingVaultId: undefined,
      creationProgress: undefined,
      error: undefined
    }))
  }

  /**
   * Set active vault directly (used after secure vault creation)
   * This allows setting vault data without going through the normal selectVault flow
   * Saves the vault ID to persistent storage for restoration
   */
  const setActiveVault = (vault: VultisigVaultInfo, addresses: Record<string, string>) => {
    setVultisigState((prev) => ({
      ...prev,
      phase: 'active',
      activeVault: vault,
      addresses,
      error: undefined
    }))

    // Save active vault ID to storage for restoration on app restart
    onSaveWallet({ type: WalletType.Vultisig, vaultId: vault.id })
  }

  /**
   * Initialize SDK and load vaults eagerly (for dropdown display)
   * This is called on service creation so vaults are available immediately
   */
  const initializeAndLoadVaults = async () => {
    try {
      window.apiLog.info('[Vultisig]', 'Initializing SDK and loading vaults eagerly...')
      await window.apiMpc.init()
      await loadVaults()
      window.apiLog.info('[Vultisig]', 'Vaults loaded:', vultisigState().availableVaults.length)
    } catch (error) {
      window.apiLog.error('[Vultisig]', 'Failed to initialize eagerly:', error)
    }
  }

  /**
   * Lock the active vault
   * Clears addresses and sets phase to 'vault-locked' to show unlock screen
   * User can then unlock the same vault or select another wallet
   */
  const lockVault = async () => {
    const currentState = vultisigState()
    if (!currentState.activeVault) {
      window.apiLog.warn('[Vultisig]', 'No active vault to lock')
      return
    }

    const vaultId = currentState.activeVault.id
    const vaultName = currentState.activeVault.name

    // Update UI state immediately (same pattern as keystore.lock())
    // This shows the unlock screen right away
    setVultisigState((prev) => ({ ...prev, phase: 'vault-locked', addresses: {} }))
    window.apiLog.info('[Vultisig]', 'Vault locked:', vaultName)

    // Inform SDK to clear cached password
    try {
      await window.apiMpc.lockVault(vaultId)
    } catch (error) {
      window.apiLog.error('[Vultisig]', 'Failed to lock vault in SDK:', error)
    }
  }

  /**
   * Unlock the active vault with password
   * Sets phase to 'active' and fetches addresses
   */
  const unlockVault = async (password: string) => {
    const currentState = vultisigState()
    window.apiLog.info('[Vultisig]', ' unlockVault called, currentPhase:', currentState.phase)
    if (!currentState.activeVault) {
      window.apiLog.info('[Vultisig]', ' unlockVault: No active vault to unlock')
      throw new Error('No active vault to unlock')
    }

    const vaultId = currentState.activeVault.id
    const vaultName = currentState.activeVault.name
    window.apiLog.info('[Vultisig]', ' unlockVault: Attempting to unlock vault:', vaultName, 'id:', vaultId)

    try {
      // Unlock the vault with password
      window.apiLog.info('[Vultisig]', ' unlockVault: Calling apiMpc.unlockVault...')
      await window.apiMpc.unlockVault(vaultId, password)
      window.apiLog.info('[Vultisig]', ' unlockVault: apiMpc.unlockVault succeeded')

      // Get addresses now that vault is unlocked
      window.apiLog.info('[Vultisig]', ' unlockVault: Fetching addresses via apiMpc.getAddresses...')
      const addresses = await window.apiMpc.getAddresses(vaultId)
      window.apiLog.info('[Vultisig]', ' unlockVault: Addresses received:', {
        chainCount: Object.keys(addresses).length,
        chains: Object.keys(addresses),
        addresses: addresses
      })

      window.apiLog.info('[Vultisig]', ' unlockVault: Updating state to phase: active')
      setVultisigState((prev) => ({ ...prev, phase: 'active', addresses, error: undefined }))
      window.apiLog.info('[Vultisig]', ' unlockVault: State updated, vault unlocked:', vaultName)
    } catch (error) {
      window.apiLog.error('[Vultisig]', ' unlockVault: Failed to unlock vault:', error)
      setVultisigState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error)
      }))
      throw error
    }
  }

  /**
   * Validate vault password WITHOUT modifying global state
   * Used by send confirmation modal to check password before triggering tx
   * Unlike unlockVault(), this does not update phase, addresses, or error state
   */
  const validatePassword = async (password: string): Promise<boolean> => {
    const currentState = vultisigState()
    if (!currentState.activeVault) return false
    try {
      await window.apiMpc.unlockVault(currentState.activeVault.id, password)
      return true
    } catch {
      return false // Don't update global state - this is just validation
    }
  }

  /**
   * Check if the active vault is locked
   */
  const isVaultLocked = (): boolean => {
    const currentState = vultisigState()
    return currentState.phase === 'vault-locked'
  }

  // Eagerly load vaults on service creation (for dropdown)
  // Use RxJS timer to not block keystore initialization
  timer(100).subscribe(() => {
    initializeAndLoadVaults()
  })

  return {
    vultisigState$,
    vultisigState,
    enterStandaloneMode,
    exitStandaloneMode,
    loadVaults,
    selectVault,
    createFastVault,
    verifyVault,
    deleteVault,
    renameVault,
    exportVault,
    resetToVaultSelection,
    setActiveVault,
    lockVault,
    unlockVault,
    validatePassword,
    isVaultLocked
  }
}
