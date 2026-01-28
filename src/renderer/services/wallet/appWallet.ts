import * as RD from '@devexperts/remote-data-ts'
import { Address, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import { Subscription } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ASGARDEX_TO_SDK_CHAIN } from '../../../shared/api/mpcTypes'
import { LastOpenedWallet } from '../../../shared/api/types'
import { WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import { network$ } from '../app/service'
import { modifyStorage, getStorageState } from '../storage/common'
import { keystoreService } from './keystore'
import { createStandaloneLedgerService } from './standaloneLedger'
import {
  AppWalletState,
  AppWalletService,
  KeystoreState,
  StandaloneLedgerState,
  StandaloneVultisigState,
  Wallet,
  isStandaloneLedgerMode,
  isStandaloneVultisigMode,
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
  const vaultManager = createVaultManager()

  // Internal app wallet state management
  const {
    get$: appWalletState$,
    get: appWalletState,
    set: setAppWalletState
  } = observableState<AppWalletState>(INITIAL_APP_WALLET_STATE)

  // Subscription storage for cleanup
  const subscriptions: Subscription[] = []

  // Listen to keystore state changes and update app wallet state accordingly
  const keystoreSub = keystoreService.keystoreState$.subscribe((keystoreState: KeystoreState) => {
    const currentAppState = appWalletState()
    const inStandaloneMode = isStandaloneLedgerMode(currentAppState) || isStandaloneVultisigMode(currentAppState)
    window.apiLog.info('[AppWallet]', 'keystoreState$ changed:', {
      hasKeystore: O.isSome(keystoreState),
      isUnlocked: O.isSome(keystoreState) && isKeystoreUnlocked(keystoreState.value),
      isVultisigMode: isStandaloneVultisigMode(currentAppState),
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

  // Listen to standalone vultisig state changes and update app wallet state accordingly
  const vultisigSub = vaultManager.standaloneVultisigState$.subscribe(
    (standaloneVultisigState: StandaloneVultisigState) => {
      const currentAppState = appWalletState()
      window.apiLog.info('[AppWallet]', 'standaloneVultisigState$ changed:', {
        phase: standaloneVultisigState.phase,
        activeVault: standaloneVultisigState.activeVault?.name,
        addressCount: Object.keys(standaloneVultisigState.addresses).length,
        addresses: standaloneVultisigState.addresses,
        isVultisigMode: isStandaloneVultisigMode(currentAppState)
      })

      // Only update if we're in standalone vultisig mode
      if (isStandaloneVultisigMode(currentAppState)) {
        window.apiLog.info('[AppWallet]', 'Propagating vultisig state to appWalletState$')
        setAppWalletState(standaloneVultisigState)
        window.apiLog.info('[AppWallet]', 'appWalletState$ updated with phase:', standaloneVultisigState.phase)
      } else {
        window.apiLog.info('[AppWallet]', 'NOT in vultisig mode, skipping state propagation')
      }
    }
  )
  subscriptions.push(vultisigSub)

  /**
   * Switch to keystore mode - clears standalone states
   */
  const switchToKeystoreMode = () => {
    // Exit standalone modes first
    standaloneLedgerService.exitStandaloneMode()
    vaultManager.exitStandaloneMode()

    // Set app state to current keystore state
    const currentKeystoreState = FP.pipe(keystoreService.keystoreState$, RxOp.take(1))
    currentKeystoreState.subscribe((keystoreState) => {
      setAppWalletState(keystoreState)
    })
  }

  /**
   * Switch to standalone ledger mode - doesn't affect keystore but changes app state
   * @param autoLock - if true, will automatically lock the keystore before switching to ledger mode
   */
  const switchToStandaloneLedgerMode = (autoLock = false) => {
    // Check if keystore is currently unlocked using the synchronous getter
    const currentKeystoreState = keystoreService.keystoreState()

    // Prevent switching to ledger-only mode if keystore is unlocked
    if (
      FP.pipe(
        currentKeystoreState,
        O.map(isKeystoreUnlocked),
        O.getOrElse(() => false)
      )
    ) {
      if (autoLock) {
        // Lock the keystore first
        keystoreService.lock()
      } else {
        // This shouldn't happen if UI is properly disabled, but keep as safety check
        window.apiLog.warn('[AppWallet]', 'Cannot switch to ledger-only mode while keystore is unlocked')
        return
      }
    }

    // Exit vultisig mode if active
    vaultManager.exitStandaloneMode()

    // Enter standalone ledger mode
    standaloneLedgerService.enterStandaloneMode()

    // Set app state to standalone ledger state
    const currentStandaloneState = FP.pipe(standaloneLedgerService.standaloneLedgerState$, RxOp.take(1))
    currentStandaloneState.subscribe((standaloneState) => {
      setAppWalletState(standaloneState)
    })
  }

  /**
   * Switch to standalone vultisig mode - doesn't affect keystore but changes app state
   * @param autoLock - if true, will automatically lock the keystore before switching
   */
  const switchToStandaloneVultisigMode = (autoLock = false) => {
    window.apiLog.info('[AppWallet]', 'switchToStandaloneVultisigMode called, autoLock:', autoLock)
    const currentAppState = appWalletState()

    // If already in vultisig mode, just update the app state (don't re-enter)
    if (isStandaloneVultisigMode(currentAppState)) {
      window.apiLog.info('[AppWallet]', 'Already in vultisig mode, skipping enterStandaloneMode')
      return
    }

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
        // Lock the keystore first
        keystoreService.lock()
      } else {
        // This shouldn't happen if UI is properly disabled, but keep as safety check
        window.apiLog.warn('[AppWallet]', 'Cannot switch to vultisig-only mode while keystore is unlocked')
        return
      }
    }

    // Exit ledger mode if active
    standaloneLedgerService.exitStandaloneMode()

    // Enter standalone vultisig mode
    window.apiLog.info('[AppWallet]', 'Entering standalone vultisig mode')
    vaultManager.enterStandaloneMode()

    // Set app state to standalone vultisig state
    const currentStandaloneState = FP.pipe(vaultManager.standaloneVultisigState$, RxOp.take(1))
    currentStandaloneState.subscribe((standaloneState) => {
      window.apiLog.info('[AppWallet]', 'Setting app state to vultisig state:', standaloneState.phase)
      setAppWalletState(standaloneState)
    })
  }

  // ============================================
  // Unified Wallet Methods (Phase A)
  // ============================================

  /**
   * Unified lock - routes to correct wallet type's lock method
   * - Keystore: locks keystore (clears phrase from memory)
   * - Vultisig: locks vault (clears password/addresses)
   * - Ledger: no-op (Ledger has no lock concept)
   */
  const lock = async (): Promise<void> => {
    const currentState = appWalletState()

    if (isStandaloneVultisigMode(currentState)) {
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

    if (isStandaloneVultisigMode(currentState)) {
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
   * Unified isLocked check - returns lock state for current wallet mode
   * - Keystore: true if no phrase in memory
   * - Vultisig: true if vault is in locked phase
   * - Ledger: always false (no lock concept)
   */
  const isLocked = (): boolean => {
    const currentState = appWalletState()

    if (isStandaloneVultisigMode(currentState)) {
      return isVultisigVaultLocked(currentState)
    } else if (isStandaloneLedgerMode(currentState)) {
      // Ledger has no lock concept - always "unlocked"
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
      if (isStandaloneVultisigMode(state)) {
        return isVultisigVaultLocked(state)
      } else if (isStandaloneLedgerMode(state)) {
        return false
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

  /**
   * Save last opened wallet with dual-write for backwards compatibility
   * - Writes to `lastOpenedWallet` in CommonStorage (new unified format)
   * - If keystore, also updates `selected` flag on keystores (old format)
   */
  const saveLastOpenedWallet = (wallet: LastOpenedWallet): void => {
    window.apiLog.info('[AppWallet]', 'saveLastOpenedWallet:', wallet)

    // Write to unified storage
    FP.pipe(
      getStorageState(),
      O.map((currentStorage) => ({
        ...currentStorage,
        lastOpenedWallet: wallet
      })),
      modifyStorage
    )

    // Dual-write: If keystore, also update selected flag for backwards compat
    // This is handled by keystoreService when changing wallets, so we don't need to do it here
    // The keystoreService.changeKeystoreWallet already updates the selected flag
  }

  // ============================================
  // Startup Loading (Phase C)
  // ============================================

  /**
   * Restore last opened wallet on startup
   * - If vultisig type → switch to Vultisig mode (enterStandaloneMode handles vault selection)
   * - If keystore type → already handled by keystoreWalletsPersistent$ subscription
   * - If not found → fallback to selected flag (existing behavior)
   */
  const restoreLastOpenedWallet = (): void => {
    // Get last opened wallet from storage synchronously
    const storageState = getStorageState()
    const lastOpened = FP.pipe(
      storageState,
      O.map((s) => s.lastOpenedWallet),
      O.toUndefined
    )

    window.apiLog.info('[AppWallet]', 'restoreLastOpenedWallet:', lastOpened)

    if (!lastOpened) {
      // No lastOpenedWallet saved - let default flows handle (selected flag fallback)
      window.apiLog.info('[AppWallet]', 'No lastOpenedWallet, using default keystore selection')
      return
    }

    if (lastOpened.type === 'vultisig') {
      // Switch to Vultisig mode - enterStandaloneMode will restore the saved vault
      window.apiLog.info('[AppWallet]', 'Restoring Vultisig vault:', lastOpened.vaultId)
      // Use autoLock=false since keystore is already locked on startup
      switchToStandaloneVultisigMode(false)
    }
    // keystore type: already handled by keystoreWalletsPersistent$ subscription
    // which uses getInitialKeystoreData() with selected flag fallback
  }

  // Trigger wallet restoration after keystore data is loaded
  // This ensures we don't try to restore before services are ready
  keystoreService.keystoreWalletsPersistent$
    .pipe(
      RxOp.filter(RD.isSuccess), // Only proceed when keystore data is loaded
      RxOp.take(1) // Only run once on startup
    )
    .subscribe(() => {
      window.apiLog.info('[AppWallet]', 'Keystore data loaded, restoring last opened wallet')
      restoreLastOpenedWallet()
    })

  // ============================================
  // Unified Wallet List and Selection (Phase D)
  // ============================================

  /**
   * Unified wallet list - combines all wallet types (keystore + vultisig)
   * Derived from existing observables, always consistent
   */
  const allWallets$: Rx.Observable<Wallet[]> = Rx.combineLatest([
    keystoreService.keystoreWalletsUI$,
    vaultManager.standaloneVultisigState$
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
    ])
  )

  /**
   * Active wallet - currently selected wallet (keystore or vultisig)
   * Derived from appWalletState$
   */
  const activeWallet$: Rx.Observable<O.Option<Wallet>> = appWalletState$.pipe(
    RxOp.map((state) => {
      if (isStandaloneVultisigMode(state) && state.activeVault) {
        return O.some<Wallet>({
          type: WalletType.Vultisig,
          id: state.activeVault.id,
          name: state.activeVault.name
        })
      } else if (isKeystoreMode(state)) {
        // When isKeystoreMode(state) is true, state IS KeystoreState = O.Option<KeystoreContent>
        // So we use O.map on state directly
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
    })
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
      if (!isStandaloneVultisigMode(currentState)) {
        // Switch to vultisig mode first (auto-lock keystore)
        switchToStandaloneVultisigMode(true)
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

        if (isStandaloneVultisigMode(state)) {
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
    if (isStandaloneVultisigMode(state)) return WalletType.Vultisig
    if (isStandaloneLedgerMode(state)) return WalletType.Ledger
    return WalletType.Keystore
  }

  /**
   * Get active vault ID for Vultisig transactions
   * Returns the vault ID if in Vultisig mode with an active vault, undefined otherwise
   */
  const getActiveVaultId = (): string | undefined => {
    const state = appWalletState()
    if (isStandaloneVultisigMode(state) && state.activeVault) {
      return state.activeVault.id
    }
    return undefined
  }

  // ============================================
  // Cleanup (Phase 7C)
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
    switchToStandaloneVultisigMode,
    // Unified methods (Phase A-C)
    lock,
    unlock,
    isLocked,
    isLocked$,
    saveLastOpenedWallet,
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
