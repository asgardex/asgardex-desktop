import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { KeystoreWalletsRD, KeystoreWalletsUI } from '../services/wallet/types'
import { useWalletContext } from 'contexts/WalletContext'

export const useKeystoreWallets = (): {
  walletsPersistentRD: KeystoreWalletsRD
  reload: FP.Lazy<void>
  walletsUI: KeystoreWalletsUI
} => {
  const {
    keystoreService: { reloadPersistentKeystoreWallets: reload, keystoreWalletsPersistent$, keystoreWalletsUI$ }
  } = useWalletContext()

  const walletsPersistentRD = useObservableState(keystoreWalletsPersistent$, RD.initial)
  const walletsUI = useObservableState(keystoreWalletsUI$, [])

  return { walletsPersistentRD, walletsUI, reload }
}
