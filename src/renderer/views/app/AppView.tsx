import React, { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Grid } from 'antd'
import * as FP from 'fp-ts/function'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { DEFAULT_LOCALE } from '../../../shared/i18n/const'
import { envOrDefault } from '../../../shared/utils/env'
import { Header } from '../../components/header'
import { Sidebar } from '../../components/sidebar'
import { BorderButton } from '../../components/uielements/button'
import { useI18nContext } from '../../contexts/I18nContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'
import { useLedgerAddresses } from '../../hooks/useLedgerAddresses'
import { useThorchainMimirHalt } from '../../hooks/useMimirHalt'
import { useMayachainMimirHalt } from '../../hooks/useMimirHaltMaya'
import { useTheme } from '../../hooks/useTheme'
import { View } from '../View'
import { ViewRoutes } from '../ViewRoutes'
import HaltedChainsWarning from './AppHaltedChains'
import MidgardErrorAlert from './AppMidgardError'
import { AppUpdateView } from './AppUpdateView'
import * as Styled from './AppView.styles'

export const AppView: React.FC = (): JSX.Element => {
  const intl = useIntl()

  const { locale$ } = useI18nContext()
  const currentLocale = useObservableState(locale$, DEFAULT_LOCALE)

  const { isLight } = useTheme()

  const isDesktopView = Grid.useBreakpoint()?.lg ?? false

  // locale
  useEffect(() => {
    // Needed to update Electron native menu according to the selected locale
    window.apiLang.update(currentLocale)
  }, [currentLocale])

  // Add/remove `dark` selector depending on selected theme (needed for tailwind)
  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
    }
  }, [isLight])

  const {
    service: {
      apiEndpoint$,
      reloadApiEndpoint,
      pools: { haltedChains$ }
    }
  } = useMidgardContext()
  const {
    service: {
      apiEndpoint$: apiEndpointMaya$,
      reloadApiEndpoint: reloadApiEndpointMaya,
      pools: { haltedChains$: haltedChainsMaya$ }
    }
  } = useMidgardMayaContext()

  const apiEndpointThor = useObservableState(apiEndpoint$, RD.initial)
  const apiEndpointMaya = useObservableState(apiEndpointMaya$, RD.initial)

  const haltedChainsThorRD = useObservableState(haltedChains$, RD.initial)
  const haltedChainsMayaRD = useObservableState(haltedChainsMaya$, RD.initial)

  const { walletsPersistentRD, reload: reloadPersistentWallets } = useKeystoreWallets()
  const { ledgerAddressesPersistentRD, reloadPersistentLedgerAddresses } = useLedgerAddresses()

  const { mimirHaltRD: mimirHaltThorRD } = useThorchainMimirHalt()
  const { mimirHaltRD: mimirHaltMayaRD } = useMayachainMimirHalt()

  const renderImportKeystoreWalletsError = useMemo(() => {
    const empty = () => <></>
    return FP.pipe(
      walletsPersistentRD,
      RD.fold(
        empty,
        empty,
        (e) => (
          <Styled.Alert
            type="warning"
            message={intl.formatMessage({ id: 'wallet.imports.error.keystore.import' })}
            description={e?.message ?? e.toString()}
            action={
              <BorderButton color="warning" size="medium" onClick={reloadPersistentWallets}>
                {intl.formatMessage({ id: 'common.retry' })}
              </BorderButton>
            }
          />
        ),
        empty
      )
    )
  }, [walletsPersistentRD, reloadPersistentWallets, intl])

  const renderImportLedgerAddressesError = useMemo(() => {
    const empty = () => <></>
    return FP.pipe(
      ledgerAddressesPersistentRD,
      RD.fold(
        empty,
        empty,
        (e) => (
          <Styled.Alert
            type="warning"
            message={intl.formatMessage({ id: 'wallet.imports.error.ledger.import' })}
            description={e?.message ?? e.toString()}
            action={
              <BorderButton color="warning" size="medium" onClick={reloadPersistentLedgerAddresses}>
                {intl.formatMessage({ id: 'common.retry' })}
              </BorderButton>
            }
          />
        ),
        empty
      )
    )
  }, [ledgerAddressesPersistentRD, reloadPersistentLedgerAddresses, intl])

  const getPublicIP = async () => {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  }

  const [publicIP, setPublicIP] = useState('')

  useEffect(() => {
    getPublicIP()
      .then((ip) => setPublicIP(ip))
      .catch((err) => console.error(err))
  }, [])

  return (
    <Styled.AppWrapper>
      <div className="flex h-full flex-col">
        <AppUpdateView />
        <Styled.AppLayout>
          {isDesktopView && <Sidebar commitHash={envOrDefault($COMMIT_HASH, '')} isDev={$IS_DEV} publicIP={publicIP} />}
          <View>
            <Header />
            <MidgardErrorAlert apiEndpoint={apiEndpointThor} reloadHandler={reloadApiEndpoint} />
            <MidgardErrorAlert apiEndpoint={apiEndpointMaya} reloadHandler={reloadApiEndpointMaya} />
            {renderImportKeystoreWalletsError}
            {renderImportLedgerAddressesError}
            <HaltedChainsWarning haltedChainsRD={haltedChainsThorRD} mimirHaltRD={mimirHaltThorRD} />
            <HaltedChainsWarning haltedChainsRD={haltedChainsMayaRD} mimirHaltRD={mimirHaltMayaRD} />
            <ViewRoutes />
          </View>
        </Styled.AppLayout>
      </div>
    </Styled.AppWrapper>
  )
}
