import { useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { LayoutlessWrapper } from '../../../components/LayoutlessWrapper'
import { ImportPhrase } from '../../../components/wallet/phrase'
import { useWalletContext } from '../../../contexts/WalletContext'
import { getWalletNamesFromKeystoreWallets } from '../../../helpers/walletHelper'
import { useKeystoreClientStates } from '../../../hooks/useKeystoreClientStates'
import { useKeystoreWallets } from '../../../hooks/useKeystoreWallets'
import * as walletRoutes from '../../../routes/wallet'
import { generateKeystoreId } from '../../../services/wallet/util'

export const ImportPhraseView = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()

  const {
    keystoreService: { addKeystoreWallet, importingKeystoreState$, resetImportingKeystoreState }
  } = useWalletContext()

  const importingKeystoreState = useObservableState(importingKeystoreState$, RD.initial)

  const { clientStates } = useKeystoreClientStates()

  const { walletsUI } = useKeystoreWallets()
  const walletNames = useMemo(() => getWalletNamesFromKeystoreWallets(walletsUI), [walletsUI])

  // Reset `ImportingKeystoreState` by entering the view
  useEffect(() => {
    resetImportingKeystoreState()
  }, [resetImportingKeystoreState])

  // Redirect after successful import
  useEffect(() => {
    if (RD.isSuccess(importingKeystoreState)) {
      resetImportingKeystoreState()
      // redirect to wallets assets view
      navigate(walletRoutes.assets.path())
    }
  }, [navigate, importingKeystoreState, resetImportingKeystoreState])

  const walletId = useMemo(() => generateKeystoreId(), [])

  return (
    <LayoutlessWrapper title={intl.formatMessage({ id: 'wallet.imports.wallet' })}>
      <ImportPhrase
        walletId={walletId}
        walletNames={walletNames}
        clientStates={clientStates}
        addKeystore={addKeystoreWallet}
      />
    </LayoutlessWrapper>
  )
}
