import { function as FP, option as O } from 'fp-ts'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { network$ } from '../app/service'
import { keystoreService } from './keystore'
import { createStandaloneLedgerService } from './standaloneLedger'
import {
  AppWalletState,
  AppWalletService,
  KeystoreState,
  StandaloneLedgerState,
  isStandaloneLedgerMode,
  isKeystoreMode
} from './types'

const INITIAL_APP_WALLET_STATE: AppWalletState = O.none // Start with no keystore (empty state)

/**
 * Combined application wallet service that manages both keystore and standalone ledger modes
 */
export const createAppWalletService = (): AppWalletService => {
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
      // Check if keystore is actually unlocked (has phrase)
      const keystoreData = keystoreState.value
      if ('phrase' in keystoreData && keystoreData.phrase) {
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
   */
  const switchToStandaloneLedgerMode = () => {
    // Enter standalone ledger mode
    standaloneLedgerService.enterStandaloneMode()

    // Set app state to standalone ledger state
    const currentStandaloneState = FP.pipe(standaloneLedgerService.standaloneLedgerState$, RxOp.take(1))
    currentStandaloneState.subscribe((standaloneState) => {
      setAppWalletState(standaloneState)
    })
  }

  return {
    appWalletState$,
    keystoreService,
    standaloneLedgerService,
    switchToKeystoreMode,
    switchToStandaloneLedgerMode
  }
}

// Create and export the singleton app wallet service
export const appWalletService = createAppWalletService()
