import { useCallback } from 'react'

import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useLocation, useNavigate } from 'react-router-dom'
import * as RxOp from 'rxjs/operators'

import { UnlockWalletSettings } from '../../components/settings'
import { useWalletContext } from '../../contexts/WalletContext'
import * as walletRoutes from '../../routes/wallet'
import { isKeystoreUnlocked } from '../../services/wallet/types'
import { WalletSettingsView } from './WalletSettingsView'

export const WalletSettingsAuth = (): JSX.Element => {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    keystoreService: { keystoreState$ }
  } = useWalletContext()

  // Note: Short delay for acting changes of `KeystoreState` is needed
  // Just to let `WalletSettingsView` process changes w/o race conditions
  // In other case it will jump to `UnlockWalletSettings` right after changing a wallet in `WalletSettingsView`
  // Use undefined instead of INITIAL_KEYSTORE_STATE to prevent showing wrong button text during delay
  const keystoreState = useObservableState(FP.pipe(keystoreState$, RxOp.delay(100)), undefined)

  const unlockWalletHandler = useCallback(() => {
    navigate(walletRoutes.base.path(location.pathname))
  }, [location.pathname, navigate])

  // Don't render anything during the delay to prevent flashing
  if (keystoreState === undefined) {
    return <div className="flex items-center justify-center bg-bg0 px-40px py-30px dark:bg-bg0d" />
  }

  return FP.pipe(
    keystoreState,
    // Get unlocked state only
    O.chain(FP.flow(O.fromPredicate(isKeystoreUnlocked))),
    O.fold(
      // keystore locked / not imported
      () => <UnlockWalletSettings keystoreState={keystoreState} unlockHandler={unlockWalletHandler} />,
      // keystore unlocked
      (keystoreUnlocked) => <WalletSettingsView keystoreUnlocked={keystoreUnlocked} />
    )
  )
}
