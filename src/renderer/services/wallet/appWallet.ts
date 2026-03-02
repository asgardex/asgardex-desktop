import * as RD from '@devexperts/remote-data-ts'
import { Address, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import { Subscription } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ASGARDEX_TO_SDK_CHAIN } from '../../../shared/api/mpcTypes'
import { LastOpenedWallet } from '../../../shared/api/types'
import { WalletType } from '../../../shared/wallet/types'
import { logger } from '../../helpers/logger'
import { observableState } from '../../helpers/stateHelper'
import { network$ } from '../app/service'
import { getStorageState, modifyStorage } from '../storage/common'
import { keystoreService } from './keystore'
import { createStandaloneLedgerService } from './standaloneLedger'
import {
  AppWalletState,
  AppWalletService,
  KeystoreState,
  StandaloneLedgerState,
  VultisigState,
  Wallet,
  isStandaloneLedgerMode,
  isVultisigMode,
  isKeystoreMode,
  isKeystoreUnlocked,
  isVultisigVaultLocked
} from './types'
import { createVaultManager } from './vaultManager'

const INITIAL_APP_WALLET_STATE: AppWalletState = O.none // Start with no keystore (empty state)

/**
 * Combined application wallet service that manages keystore, standalone ledger, and standalone vultisig modes
 */
export const createAppWalletService = (): AppWalletService => {
  // Create standalone services
  const standaloneLedgerService = createStandaloneLedgerService({ network$ })

  /**
   * Centralized storage write for the last opened wallet.
   * All wallet modes (keystore, vultisig) should use this instead of calling modifyStorage directly.
   * Pass `undefined` to clear the saved wallet.
   */
  const saveLastOpenedWallet = (wallet: LastOpenedWallet | undefined): void => {
    modifyStorage(O.some({ lastOpenedWallet: wallet }))
  }

  const vaultManager = createVaultManager(saveLastOpenedWallet)

  // Store subscriptions for cleanup
  const subscriptions: Subscription[] = []

  // Internal app wallet state management
  const {
    get$: appWalletState$,
    get: appWalletState,
    set: setAppWalletState
  } = observableState<AppWalletState>(INITIAL_APP_WALLET_STATE)

  // Flag to suppress keystoreSub during intentional mode switches.
  // When switchToVultisigMode or switchToStandaloneLedgerMode calls keystoreService.lock(),
  // the resulting keystoreState$ emission should NOT overwrite the app state mid-transition.
  let _modeTransitioning = false

  // Listen to keystore state changes and update app wallet state accordingly
  const keystoreSub = keystoreService.keystoreState$.subscribe((keystoreState: KeystoreState) => {
    // Skip during intentional mode switches (e.g., switchToVultisigMode calling lock())
    if (_modeTransitioning) {
      window.apiLog.info('[AppWallet]', 'keystoreState$ changed during mode transition, skipping')
      return
    }

    const currentAppState = appWalletState()
    const inStandaloneMode = isStandaloneLedgerMode(currentAppState) || isVultisigMode(currentAppState)
    window.apiLog.info('[AppWallet]', 'keystoreState$ changed:', {
      hasKeystore: O.isSome(keystoreState),
      isUnlocked: O.isSome(keystoreState) && isKeystoreUnlocked(keystoreState.value),
      isVultisigMode: isVultisigMode(currentAppState),
      isLedgerMode: isStandaloneLedgerMode(currentAppState),
      isKeystoreMode: isKeystoreMode(currentAppState)
    })

    // If a keystore wallet is selected (becomes Some) and we're in standalone mode,
    // switch to keystore mode - even if the keystore is locked.
    // This handles the case where user selects a keystore wallet from the dropdown
    // while in Vultisig or Ledger mode.
    if (O.isSome(keystoreState) && inStandaloneMode) {
      window.apiLog.info('[AppWallet]', 'Keystore selected while in standalone mode, switching to keystore mode')
      // IMPORTANT: Set app state FIRST to prevent race condition where
      // exitStandaloneMode triggers subscription that overwrites this state
      setAppWalletState(keystoreState)
      // Exit standalone modes (this will trigger their subscriptions, but
      // they'll see we're no longer in standalone mode and skip updating)
      standaloneLedgerService.exitStandaloneMode()
      vaultManager.exitStandaloneMode()
      return
    }

    // Only update if we're in keystore mode or transitioning to it
    if (isKeystoreMode(currentAppState) || O.isSome(keystoreState)) {
      window.apiLog.info('[AppWallet]', 'Updating app wallet state to keystore state')
      setAppWalletState(keystoreState)
    }
  })
  subscriptions.push(keystoreSub)

  // Listen to standalone ledger state changes and update app wallet state accordingly
  const ledgerSub = standaloneLedgerService.standaloneLedgerState$.subscribe(
    (standaloneLedgerState: StandaloneLedgerState) => {
      // Only update if we're in standalone ledger mode
      if (isStandaloneLedgerMode(appWalletState())) {
        setAppWalletState(standaloneLedgerState)
      }
    }
  )
  subscriptions.push(ledgerSub)

  // Listen to vultisig state changes and update app wallet state accordingly
  const vultisigSub = vaultManager.vultisigState$.subscribe((newVultisigState: VultisigState) => {
    const currentAppState = appWalletState()
    window.apiLog.info('[AppWallet]', 'vultisigState$ changed:', {
      phase: newVultisigState.phase,
      activeVault: newVultisigState.activeVault?.name,
      addressCount: Object.keys(newVultisigState.addresses).length,
      addresses: newVultisigState.addresses,
      isVultisigMode: isVultisigMode(currentAppState)
    })

    // Only update if we're in vultisig mode
    if (isVultisigMode(currentAppState)) {
      window.apiLog.info('[AppWallet]', 'Propagating vultisig state to appWalletState$')
      setAppWalletState(newVultisigState)
      window.apiLog.info('[AppWallet]', 'appWalletState$ updated with phase:', newVultisigState.phase)
    } else {
      window.apiLog.info('[AppWallet]', 'NOT in vultisig mode, skipping state propagation')
    }
  })
  subscriptions.push(vultisigSub)

  /**
   * Switch to keystore mode - clears standalone states
   */
  const switchToKeystoreMode = async () => {
    // Exit standalone modes first
    standaloneLedgerService.exitStandaloneMode()
    vaultManager.exitStandaloneMode()

    // Set app state to current keystore state
    const keystoreState = await keystoreService.keystoreState$.pipe(RxOp.take(1)).toPromise()
    if (keystoreState !== undefined) {
      setAppWalletState(keystoreState)
    }
  }

  /**
   * Switch to standalone ledger mode - doesn't affect keystore but changes app state
   * @param autoLock - if true, will automatically lock the keystore before switching to ledger mode
   */
  const switchToStandaloneLedgerMode = async (autoLock = false) => {
    // Check if any wallet (keystore or vultisig) is currently unlocked
    if (!isLocked()) {
      if (autoLock) {
        _modeTransitioning = true
        try {
          // Lock the current wallet — suppress keystoreSub so it doesn't overwrite state
          await lock()
        } finally {
          _modeTransitioning = false
        }
      } else {
        // This shouldn't happen if UI is properly disabled, but keep as safety check
        logger.warn('Cannot switch to ledger-only mode while keystore is unlocked')
        return
      }
    }

    // NOTE: Do NOT call vaultManager.exitStandaloneMode() here.
    // Vault state is preserved so it can be restored when exiting Ledger mode.
    // The vultisigSub won't propagate changes since appWalletState is now Ledger mode.

    // Enter standalone ledger mode
    standaloneLedgerService.enterStandaloneMode()

    // Set app state to standalone ledger state
    const standaloneState = await standaloneLedgerService.standaloneLedgerState$.pipe(RxOp.take(1)).toPromise()
    if (standaloneState !== undefined) {
      setAppWalletState(standaloneState)
    }
  }

  /**
   * Switch to standalone vultisig mode - doesn't affect keystore but changes app state
   * @param autoLock - if true, will automatically lock the keystore before switching
   */
  const switchToVultisigMode = async (autoLock = false) => {
    window.apiLog.info('[AppWallet]', 'switchToVultisigMode called, autoLock:', autoLock)
    const currentAppState = appWalletState()

    // If already in vultisig mode, just update the app state (don't re-enter)
    if (isVultisigMode(currentAppState)) {
      window.apiLog.info('[AppWallet]', 'Already in vultisig mode, skipping enterStandaloneMode')
      return
    }

    _modeTransitioning = true
    try {
      // Check if keystore is currently unlocked using the synchronous getter
      const currentKeystoreState = keystoreService.keystoreState()

      // Prevent switching to vultisig-only mode if keystore is unlocked
      if (
        FP.pipe(
          currentKeystoreState,
          O.map(isKeystoreUnlocked),
          O.getOrElse(() => false)
        )
      ) {
        if (autoLock) {
          window.apiLog.info('[AppWallet]', 'Locking keystore before switching to vultisig mode')
          // Lock the keystore — keystoreSub is suppressed by _modeTransitioning flag
          keystoreService.lock()
        } else {
          // This shouldn't happen if UI is properly disabled, but keep as safety check
          window.apiLog.warn('[AppWallet]', 'Cannot switch to vultisig-only mode while keystore is unlocked')
          return
        }
      }

      // Exit ledger mode if active
      standaloneLedgerService.exitStandaloneMode()

      // Enter standalone vultisig mode and AWAIT completion
      // enterStandaloneMode is async (SDK init, vault loading, vault restoration)
      window.apiLog.info('[AppWallet]', 'Entering standalone vultisig mode')
      await vaultManager.enterStandaloneMode()

      // Use synchronous getter — enterStandaloneMode has completed, state is final
      const standaloneState = vaultManager.vultisigState()
      window.apiLog.info('[AppWallet]', 'Setting app state to vultisig state:', standaloneState.phase)
      setAppWalletState(standaloneState)
    } finally {
      _modeTransitioning = false
    }
  }

  // ============================================
  // Unified Wallet Methods
  // ============================================

  /**
   * Unified lock - routes to correct wallet type's lock method
   * - Keystore: locks keystore (clears phrase from memory)
   * - Vultisig: locks vault (clears password/addresses)
   * - Ledger: no-op (Ledger has no lock concept)
   */
  const lock = async (): Promise<void> => {
    const currentState = appWalletState()

    if (isVultisigMode(currentState)) {
      await vaultManager.lockVault()
    } else if (!isStandaloneLedgerMode(currentState)) {
      // Keystore mode
      keystoreService.lock()
    }
    // Ledger has no lock concept - no-op
  }

  /**
   * Unified unlock - routes to correct wallet type's unlock method
   * - Keystore: unlocks keystore (decrypts phrase into memory)
   * - Vultisig: unlocks vault (validates password, fetches addresses)
   * - Ledger: always returns true (no unlock concept)
   */
  const unlock = async (password: string): Promise<boolean> => {
    const currentState = appWalletState()

    if (isVultisigMode(currentState)) {
      try {
        await vaultManager.unlockVault(password)
        return true
      } catch {
        return false
      }
    } else if (isStandaloneLedgerMode(currentState)) {
      // Ledger has no unlock concept - always "unlocked"
      return true
    } else {
      // Keystore mode
      try {
        await keystoreService.unlock(password)
        return true
      } catch {
        return false
      }
    }
  }

  /**
   * Validate password WITHOUT modifying global state
   * Used by send confirmation modal to check Vultisig vault password
   * Unlike unlock(), this does not change phase, addresses, or error state on failure
   */
  const validatePassword = async (password: string): Promise<boolean> => {
    return vaultManager.validatePassword(password)
  }

  /**
   * Unified isLocked check - returns lock state for current wallet mode
   * - Keystore: true if no phrase in memory
   * - Vultisig: true if vault is in locked phase
   * - Ledger: always false (no lock concept)
   */
  const isLocked = (): boolean => {
    const currentState = appWalletState()

    if (isVultisigMode(currentState)) {
      return isVultisigVaultLocked(currentState)
    } else if (isStandaloneLedgerMode(currentState)) {
      // Ledger is hardware-connected, never "locked" in keystore sense
      // Matches isLocked$ behavior
      return false
    } else {
      // Keystore mode
      return FP.pipe(
        currentState,
        O.map((kc) => !isKeystoreUnlocked(kc)),
        O.getOrElse(() => true) // No keystore = locked
      )
    }
  }

  /**
   * Observable for lock state - emits when lock state changes
   */
  const isLocked$: Rx.Observable<boolean> = appWalletState$.pipe(
    RxOp.map((state) => {
      if (isVultisigMode(state)) {
        return isVultisigVaultLocked(state)
      } else if (isStandaloneLedgerMode(state)) {
        return false // Ledger is hardware-connected, never "locked" in keystore sense
      } else {
        return FP.pipe(
          state,
          O.map((kc) => !isKeystoreUnlocked(kc)),
          O.getOrElse(() => true)
        )
      }
    }),
    RxOp.distinctUntilChanged()
  )

  // ============================================
  // Startup Loading
  // ============================================

  /**
   * Restore last opened wallet from storage.
   * Used on startup AND when exiting Ledger mode — same logic:
   * - If vultisig → switch to Vultisig mode (enterStandaloneMode handles vault selection)
   * - If keystore or absent → switch to Keystore mode (existing keystore flow)
   */
  const restoreLastOpenedWallet = async (): Promise<void> => {
    // Exit ledger standalone mode if active
    standaloneLedgerService.exitStandaloneMode()

    const storageState = getStorageState()
    const lastOpened = FP.pipe(
      storageState,
      O.map((s) => s.lastOpenedWallet),
      O.toUndefined
    )

    window.apiLog.info('[AppWallet]', 'restoreLastOpenedWallet:', lastOpened)

    if (lastOpened?.type === WalletType.Vultisig) {
      window.apiLog.info('[AppWallet]', 'Restoring Vultisig vault:', lastOpened.vaultId)
      await switchToVultisigMode(false)
    } else {
      window.apiLog.info('[AppWallet]', 'Restoring Keystore mode')
      await switchToKeystoreMode()
    }
  }

  // Trigger wallet restoration after keystore data is loaded
  // This ensures we don't try to restore before services are ready
  const startupSub = keystoreService.keystoreWalletsPersistent$
    .pipe(
      RxOp.filter(RD.isSuccess), // Only proceed when keystore data is loaded
      RxOp.take(1) // Only run once on startup
    )
    .subscribe(() => {
      window.apiLog.info('[AppWallet]', 'Keystore data loaded, restoring last opened wallet')
      restoreLastOpenedWallet()
    })
  subscriptions.push(startupSub)

  // ============================================
  // Unified Wallet List and Selection
  // ============================================

  /**
   * Unified wallet list - combines all wallet types (keystore + vultisig)
   * Derived from existing observables, always consistent
   */
  const allWallets$: Rx.Observable<Wallet[]> = Rx.combineLatest([
    keystoreService.keystoreWalletsUI$,
    vaultManager.vultisigState$
  ]).pipe(
    RxOp.map(([keystoreWallets, vultisigState]) => [
      ...keystoreWallets.map(
        (w): Wallet => ({
          type: WalletType.Keystore,
          id: w.id,
          name: w.name
        })
      ),
      ...vultisigState.availableVaults.map(
        (v): Wallet => ({
          type: WalletType.Vultisig,
          id: v.id,
          name: v.name
        })
      )
    ]),
    RxOp.shareReplay(1)
  )

  /**
   * Active wallet - currently selected wallet (keystore or vultisig)
   * Derived from appWalletState$
   */
  const activeWallet$: Rx.Observable<O.Option<Wallet>> = Rx.combineLatest([
    appWalletState$,
    vaultManager.vultisigState$,
    keystoreService.keystoreState$
  ]).pipe(
    RxOp.map(([state, vultisigState, keystoreState]) => {
      if (isVultisigMode(state) && state.activeVault) {
        return O.some<Wallet>({
          type: WalletType.Vultisig,
          id: state.activeVault.id,
          name: state.activeVault.name
        })
      } else if (isStandaloneLedgerMode(state)) {
        // In Ledger mode, show the previously active wallet.
        // Vault state is preserved (not cleared on Ledger entry).
        if (vultisigState.activeVault) {
          return O.some<Wallet>({
            type: WalletType.Vultisig,
            id: vultisigState.activeVault.id,
            name: vultisigState.activeVault.name
          })
        }
        return FP.pipe(
          keystoreState,
          O.map(
            (kc): Wallet => ({
              type: WalletType.Keystore,
              id: kc.id,
              name: kc.name
            })
          )
        )
      } else if (isKeystoreMode(state)) {
        return FP.pipe(
          state,
          O.map(
            (kc): Wallet => ({
              type: WalletType.Keystore,
              id: kc.id,
              name: kc.name
            })
          )
        )
      }
      return O.none
    }),
    RxOp.shareReplay(1)
  )

  /**
   * Unified wallet selection - routes to correct handler based on wallet type
   * Returns Promise for consistency (vultisig selectVault is async)
   */
  const selectWallet = async (wallet: Wallet): Promise<void> => {
    window.apiLog.info('[AppWallet]', 'selectWallet:', wallet)

    if (wallet.type === WalletType.Keystore) {
      // Selecting keystore wallet - let keystoreService handle it
      // This will trigger keystoreState$ change which updates appWalletState$
      // Note: changeKeystoreWallet returns LiveData, we convert to Promise
      return new Promise((resolve, reject) => {
        keystoreService.changeKeystoreWallet(wallet.id).subscribe({
          next: (rd) => {
            if (RD.isSuccess(rd)) resolve()
            if (RD.isFailure(rd)) reject(rd.error)
          },
          error: reject
        })
      })
    } else if (wallet.type === WalletType.Vultisig) {
      // Selecting vultisig vault - switch to vultisig mode and select vault
      const currentState = appWalletState()
      if (!isVultisigMode(currentState)) {
        // Switch to vultisig mode first (auto-lock keystore)
        // Await so enterStandaloneMode completes (SDK init, vault loading) before selectVault
        await switchToVultisigMode(true)
      }
      // Select the vault (this is async)
      await vaultManager.selectVault(wallet.id)
    }
  }

  /**
   * Get address for a specific chain from current wallet
   * Unified approach - works for Keystore, Ledger, and Vultisig
   * ONE call to know wallet state - no scattered mode checks needed
   */
  const getAddressForChain$ = (chain: Chain): Rx.Observable<O.Option<Address>> => {
    return appWalletState$.pipe(
      RxOp.map((state) => {
        if (!state) return O.none

        if (isVultisigMode(state)) {
          const sdkChainName = ASGARDEX_TO_SDK_CHAIN[chain]
          if (!sdkChainName) return O.none
          return O.fromNullable(state.addresses[sdkChainName])
        }

        if (isStandaloneLedgerMode(state)) {
          return state.address?.chain === chain ? O.some(state.address.address) : O.none
        }

        // Keystore mode - return O.none, caller should use xchainjs client
        // This is intentional: keystore addresses are derived from phrase via clients
        return O.none
      }),
      RxOp.distinctUntilChanged((a, b) => O.getEq({ equals: (x: Address, y: Address) => x === y }).equals(a, b))
    )
  }

  /**
   * Get current wallet type synchronously
   * Useful for UI components that need to know wallet type without subscribing
   */
  const getCurrentWalletType = (): WalletType => {
    const state = appWalletState()
    if (isVultisigMode(state)) return WalletType.Vultisig
    if (isStandaloneLedgerMode(state)) return WalletType.Ledger
    return WalletType.Keystore
  }

  /**
   * Get active vault ID for Vultisig transactions
   * Returns the vault ID if in Vultisig mode with an active vault, undefined otherwise
   */
  const getActiveVaultId = (): string | undefined => {
    const state = appWalletState()
    if (isVultisigMode(state) && state.activeVault) {
      return state.activeVault.id
    }
    return undefined
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Dispose all subscriptions
   * Called for cleanup (tests, hot-reload, future shutdown wiring)
   */
  const dispose = (): void => {
    subscriptions.forEach((sub) => sub.unsubscribe())
    subscriptions.length = 0 // Clear array
    window.apiLog.info('[AppWallet]', 'Disposed all subscriptions')
  }

  return {
    appWalletState$,
    keystoreService,
    standaloneLedgerService,
    vaultManager,
    switchToKeystoreMode,
    switchToStandaloneLedgerMode,
    switchToVultisigMode,
    restoreLastOpenedWallet,
    saveLastOpenedWallet,
    // Unified methods (Phase A-C)
    lock,
    unlock,
    validatePassword,
    isLocked,
    isLocked$,
    // Unified wallet list and selection (Phase D)
    allWallets$,
    activeWallet$,
    selectWallet,
    // Unified address access (Phase 5C)
    getAddressForChain$,
    getCurrentWalletType,
    getActiveVaultId,
    // Cleanup (Phase 7C)
    dispose
  }
}

// Create and export the singleton app wallet service
export const appWalletService = createAppWalletService()
