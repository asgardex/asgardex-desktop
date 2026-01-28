import { useObservableState } from 'observable-hooks'
import { Navigate, useLocation } from 'react-router-dom'

import { useWalletContext } from '../../contexts/WalletContext'
import { ReferrerState } from '../../routes/types'
import * as walletRoutes from '../../routes/wallet'
import { isStandaloneLedgerMode, isStandaloneVultisigMode } from '../../services/wallet/types'
import { hasImportedKeystore } from '../../services/wallet/util'

export const WalletAuth = ({ children }: { children: JSX.Element }): JSX.Element => {
  const { appWalletService } = useWalletContext()

  const location = useLocation()

  // Use the new app wallet state that can be either keystore or standalone ledger
  const appWalletState = useObservableState(appWalletService.appWalletState$, undefined)

  // Special case: app wallet state can be `undefined` during initialization
  if (appWalletState === undefined) {
    return <></>
  }

  // Ledger mode has no authentication/lock concept
  if (isStandaloneLedgerMode(appWalletState)) {
    return children
  }

  // Keystore mode requires an imported keystore
  if (!isStandaloneLedgerMode(appWalletState) && !isStandaloneVultisigMode(appWalletState)) {
    if (!hasImportedKeystore(appWalletState)) {
      return (
        <Navigate
          to={{
            pathname: walletRoutes.noWallet.path()
          }}
          replace
        />
      )
    }
  }

  // Unified lock check for both Keystore and Vultisig
  if (appWalletService.isLocked()) {
    return (
      <Navigate
        to={{
          pathname: walletRoutes.locked.path(),
          search: location.search
        }}
        state={{ referrer: (location.state as ReferrerState)?.referrer ?? location.pathname }}
        replace
      />
    )
  }

  return children
}
