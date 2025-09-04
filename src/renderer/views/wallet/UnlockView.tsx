import { UnlockForm } from '../../components/wallet/unlock'
import { useKeystoreState } from '../../hooks/useKeystoreState'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'

export const UnlockView = (): JSX.Element => {
  const { state: keystore, unlock, remove, change$ } = useKeystoreState()
  const { walletsUI } = useKeystoreWallets()

  return (
    <UnlockForm
      keystore={keystore}
      unlock={unlock}
      removeKeystore={remove}
      changeKeystore$={change$}
      wallets={walletsUI}
    />
  )
}
