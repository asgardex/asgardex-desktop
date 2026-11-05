import { option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { DEFAULT_XMR_CONNECTION_CONFIG, xmrConnectionConfig$ } from '../../services/monero/config'
import { viewKeys$ } from '../../services/monero/common'
import { isLwsConfirmationValid } from '../../services/monero/lwsConfirmation'
import { xmrScanStatus$, XmrScanStatus } from '../../services/monero/scanner'
import { confirmLwsForCurrentWallet, exportKeysOfCurrentWallet } from '../../services/monero/settingsActions'
import { keystoreService } from '../../services/wallet/keystore'
import { MoneroSettingsActions, MoneroSettingsPanel } from './MoneroSettingsPanel'

const defaultActions: MoneroSettingsActions = {
  validatePassword$: keystoreService.validatePassword$,
  confirmLws: confirmLwsForCurrentWallet,
  exportKeys: exportKeysOfCurrentWallet
}

/** Panel connected to the persisted Monero connection settings */
export const MoneroSettingsConnected = (): JSX.Element => {
  const config = useObservableState(xmrConnectionConfig$, DEFAULT_XMR_CONNECTION_CONFIG)
  const scanStatus = useObservableState(xmrScanStatus$, { kind: 'idle' } as XmrScanStatus)
  const oViewKeys = useObservableState(viewKeys$, O.none)
  // The stored confirmation counts only if it is valid for the CURRENT wallet
  const lwsConfirmedForWallet =
    O.isSome(oViewKeys) && isLwsConfirmationValid(oViewKeys.value, config.lwsUrl, config.lwsConfirmation)
  return (
    <MoneroSettingsPanel
      config={config}
      scanStatus={scanStatus}
      lwsConfirmedForWallet={lwsConfirmedForWallet}
      actions={defaultActions}
    />
  )
}
