import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { Navigate, useLocation } from 'react-router-dom'
import * as RxOp from 'rxjs/operators'

import { useWalletContext } from '../../contexts/WalletContext'
import * as walletRoutes from '../../routes/wallet'
import {
  isKeystoreUnlocked,
  isVultisigMode,
  isVultisigVaultLocked,
  isStandaloneLedgerMode
} from '../../services/wallet/types'
import { hasImportedKeystore } from '../../services/wallet/util'
import { VultisigSettingsView } from './VultisigSettingsView'
import { WalletSettingsView } from './WalletSettingsView'

export const WalletSettingsAuth = (): JSX.Element => {
  const location = useLocation()
  const { appWalletService } = useWalletContext()

  // Unified app wallet state with short delay to prevent flash during wallet changes.
  // Without the delay, changing wallets in WalletSettingsView immediately emits a locked
  // keystore state, causing a brief jump before the view processes the change.
  const appWalletState = useObservableState(FP.pipe(appWalletService.appWalletState$, RxOp.delay(100)), undefined)

  // Don't render anything during initialization
  if (appWalletState === undefined) {
    return <div className="flex items-center justify-center bg-bg0 px-40px py-30px dark:bg-bg0d" />
  }

  // Vultisig mode: redirect to unlock page if locked, otherwise full settings
  if (isVultisigMode(appWalletState)) {
    if (isVultisigVaultLocked(appWalletState)) {
      return <Navigate to={{ pathname: walletRoutes.locked.path() }} state={{ referrer: location.pathname }} replace />
    }
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

  // Keystore mode: redirect to no-wallet page if no keystore imported
  if (!hasImportedKeystore(appWalletState)) {
    return <Navigate to={{ pathname: walletRoutes.noWallet.path() }} replace />
  }

  // Keystore mode: redirect to unlock page if locked, otherwise show settings
  return FP.pipe(
    appWalletState,
    O.chain(FP.flow(O.fromPredicate(isKeystoreUnlocked))),
    O.fold(
      () => <Navigate to={{ pathname: walletRoutes.locked.path() }} state={{ referrer: location.pathname }} replace />,
      (keystoreUnlocked) => <WalletSettingsView keystoreUnlocked={keystoreUnlocked} />
    )
  )
}
