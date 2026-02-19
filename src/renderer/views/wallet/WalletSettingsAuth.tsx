import { useCallback } from 'react'

import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useLocation, useNavigate } from 'react-router-dom'
import * as RxOp from 'rxjs/operators'

import { UnlockWalletSettings } from '../../components/settings'
import { useWalletContext } from '../../contexts/WalletContext'
import * as walletRoutes from '../../routes/wallet'
import { isKeystoreUnlocked, isVultisigMode, isStandaloneLedgerMode } from '../../services/wallet/types'
import { VultisigSettingsView } from './VultisigSettingsView'
import { WalletSettingsView } from './WalletSettingsView'

export const WalletSettingsAuth = (): JSX.Element => {
  const navigate = useNavigate()
  const location = useLocation()
  const { appWalletService } = useWalletContext()

  // Unified app wallet state with short delay to prevent flash during wallet changes.
  // Without the delay, changing wallets in WalletSettingsView immediately emits a locked
  // keystore state, causing a brief jump to UnlockWalletSettings before the view processes
  // the change. Applied uniformly across all modes for consistency.
  const appWalletState = useObservableState(FP.pipe(appWalletService.appWalletState$, RxOp.delay(100)), undefined)

  const unlockWalletHandler = useCallback(() => {
    navigate(walletRoutes.base.path(location.pathname))
  }, [location.pathname, navigate])

  // Don't render anything during initialization
  if (appWalletState === undefined) {
    return <div className="flex items-center justify-center bg-bg0 px-40px py-30px dark:bg-bg0d" />
  }

  // Vultisig mode: route through unified WalletSettings (with vultisig props)
  if (isVultisigMode(appWalletState)) {
    return <VultisigSettingsView vultisigState={appWalletState} />
  }

  // Ledger mode: show message (Ledger has no settings concept like keystore)
  if (isStandaloneLedgerMode(appWalletState)) {
    return (
      <div className="flex items-center justify-center bg-bg0 px-40px py-30px dark:bg-bg0d">
        <span className="text-text2 dark:text-text2d">Ledger mode active — no wallet settings available</span>
      </div>
    )
  }

  // Keystore mode: appWalletState is KeystoreState (O.Option<KeystoreContent>)
  return FP.pipe(
    appWalletState,
    // Get unlocked state only
    O.chain(FP.flow(O.fromPredicate(isKeystoreUnlocked))),
    O.fold(
      // keystore locked / not imported
      () => <UnlockWalletSettings keystoreState={appWalletState} unlockHandler={unlockWalletHandler} />,
      // keystore unlocked
      (keystoreUnlocked) => <WalletSettingsView keystoreUnlocked={keystoreUnlocked} />
    )
  )
}
