import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { network$ } from '../app/service'
import { keystoreService } from './keystore'
import { createStandaloneLedgerService } from './standaloneLedger'
import {
  AppWalletState,
  KeystoreState,
  StandaloneLedgerState,
  WatchOnlyState,
  isStandaloneLedgerMode,
  isWatchOnlyMode,
  isKeystoreMode,
  isKeystoreUnlocked
} from './types'
import { watchOnlyService } from './watchOnly'

const INITIAL_APP_WALLET_STATE: AppWalletState = O.none // Start with no keystore (empty state)

/**
 * Combined application wallet service that manages both keystore and standalone ledger modes
 */
export const createAppWalletService = () => {
  // Create standalone ledger service
  const standaloneLedgerService = createStandaloneLedgerService({ network$ })

  // Internal app wallet state management
  const {
    get$: appWalletState$,
    get: appWalletState,
    set: setAppWalletState
  } = observableState<AppWalletState>(INITIAL_APP_WALLET_STATE)

  // Listen to keystore state changes and update app wallet state accordingly
  keystoreService.keystoreState$.subscribe((keystoreState: KeystoreState) => {
    const currentAppState = appWalletState()

    // If keystore becomes unlocked and we're in standalone ledger mode, switch to keystore mode
    if (O.isSome(keystoreState) && isStandaloneLedgerMode(currentAppState)) {
      // Check if keystore is actually unlocked
      if (isKeystoreUnlocked(keystoreState.value)) {
        // Exit standalone ledger mode and switch to keystore
        standaloneLedgerService.exitStandaloneMode()
        setAppWalletState(keystoreState)
        return
      }
    }

    // Only update if we're in keystore mode or transitioning to it
    if (isKeystoreMode(currentAppState) || O.isSome(keystoreState)) {
      setAppWalletState(keystoreState)
    }
  })

  // Listen to standalone ledger state changes and update app wallet state accordingly
  standaloneLedgerService.standaloneLedgerState$.subscribe((standaloneLedgerState: StandaloneLedgerState) => {
    const currentAppState = appWalletState()

    // Only update if we're in standalone ledger mode
    if (isStandaloneLedgerMode(currentAppState)) {
      setAppWalletState(standaloneLedgerState)
    }
  })

  // Listen to watch-only state changes and update app wallet state accordingly
  watchOnlyService.watchOnlyState$.subscribe((watchOnlyState: WatchOnlyState | null) => {
    const currentAppState = appWalletState()

    // If watch-only state exists, update app state to watch-only mode
    if (watchOnlyState) {
      setAppWalletState(watchOnlyState)
    }
    // If watch-only state is null and we're currently in watch-only mode, exit to keystore mode
    else if (!watchOnlyState && isWatchOnlyMode(currentAppState)) {
      // Switch back to keystore mode
      const currentKeystoreState = keystoreService.keystoreState()
      setAppWalletState(currentKeystoreState)
    }
  })

  /**
   * Switch to keystore mode - clears standalone ledger state
   */
  const switchToKeystoreMode = () => {
    // Exit standalone mode first
    standaloneLedgerService.exitStandaloneMode()

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
        console.warn('Cannot switch to ledger-only mode while keystore is unlocked')
        return
      }
    }

    // Enter standalone ledger mode
    standaloneLedgerService.enterStandaloneMode()

    // Set app state to standalone ledger state
    const currentStandaloneState = FP.pipe(standaloneLedgerService.standaloneLedgerState$, RxOp.take(1))
    currentStandaloneState.subscribe((standaloneState) => {
      setAppWalletState(standaloneState)
    })
  }

  /**
   * Switch to watch-only mode - allows viewing addresses without private keys
   */
  const switchToWatchOnlyMode = () => {
    // Exit standalone mode if active
    standaloneLedgerService.exitStandaloneMode()

    // The watch-only subscription will handle state updates
    // If no watch wallets are loaded, the state will remain null
  }

  /**
   * Export keystore addresses as watch-only wallets
   */
  const exportKeystoreAsWatchOnly = (walletAccounts?: Array<{ chain: Chain; address: string }>) => {
    return watchOnlyService.exportKeystoreAsWatchOnly(walletAccounts)
  }

  return {
    appWalletState$,
    keystoreService,
    standaloneLedgerService,
    watchOnlyService,
    switchToKeystoreMode,
    switchToStandaloneLedgerMode,
    switchToWatchOnlyMode,
    exportKeystoreAsWatchOnly
  }
}

// Create and export the singleton app wallet service
export const appWalletService = createAppWalletService()
