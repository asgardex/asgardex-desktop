import React, { useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'

import { ExternalUrl } from '../../../shared/const'
import { DEFAULT_LOCALE } from '../../../shared/i18n/const'
import { envOrDefault } from '../../../shared/utils/env'
import { AppSettings } from '../../components/settings'
import { useI18nContext } from '../../contexts/I18nContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useAppUpdate } from '../../hooks/useAppUpdate'
import { useCollapsedSetting } from '../../hooks/useCollapsedSetting'
import { useDex } from '../../hooks/useDex'
import { useMayachainClientUrl } from '../../hooks/useMayachainClientUrl'
import { useNetwork } from '../../hooks/useNetwork'
import { usePrivateData } from '../../hooks/usePrivateData'
import { useThorchainClientUrl } from '../../hooks/useThorchainClientUrl'

export const AppSettingsView: React.FC = (): JSX.Element => {
  const { network, changeNetwork } = useNetwork()
  const { dex, changeDex } = useDex()
  const { appUpdater, checkForUpdates } = useAppUpdate()
  const {
    service: { apiEndpoint$, setMidgardUrl, checkMidgardUrl$ }
  } = useMidgardContext()
  const {
    service: {
      apiEndpoint$: apiEndpointMaya$,
      setMidgardUrl: setMidgardMayaUrl,
      checkMidgardUrl$: checkMidgardMayaUrl$
    }
  } = useMidgardMayaContext()
  const midgardUrl = useObservableState(apiEndpoint$, RD.initial)
  const midgardMayaUrl = useObservableState(apiEndpointMaya$, RD.initial)

  const { isPrivate, changePrivateData } = usePrivateData()

  const { collapsed, toggle: toggleCollapse } = useCollapsedSetting('app')

  const {
    node: thornodeNodeUrl,
    rpc: thornodeRpcUrl,
    setRpc: setThornodeRpcUrl,
    setNode: setThornodeNodeUrl,
    checkRpc$: checkThornodeRpcUrl$,
    checkNode$: checkThornodeNodeUrl$
  } = useThorchainClientUrl()

  const {
    node: mayanodeNodeUrl,
    rpc: mayanodeRpcUrl,
    setRpc: setMayanodeRpcUrl,
    setNode: setMayanodeNodeUrl,
    checkRpc$: checkMayanodeRpcUrl$,
    checkNode$: checkMayanodeNodeUrl$
  } = useMayachainClientUrl()

  const { changeLocale, locale$ } = useI18nContext()
  const currentLocale = useObservableState(locale$, DEFAULT_LOCALE)

  const goToReleasePage = useCallback(
    (version: string) => window.apiUrl.openExternal(`${ExternalUrl.GITHUB_RELEASE}${version}`),
    []
  )

  const updateMidgardUrlHandler = useCallback(
    (url: string) => {
      setMidgardUrl(url, network)
    },
    [network, setMidgardUrl]
  )
  const updateMidgardMayaUrlHandler = useCallback(
    (url: string) => {
      setMidgardMayaUrl(url, network)
    },
    [network, setMidgardMayaUrl]
  )

  return (
    <AppSettings
      locale={currentLocale}
      changeLocale={changeLocale}
      network={network}
      dex={dex}
      changeNetwork={changeNetwork}
      changeDex={changeDex}
      togglePrivate={changePrivateData}
      isPrivate={isPrivate}
      version={envOrDefault($VERSION, '-')}
      appUpdateState={appUpdater}
      checkForUpdates={checkForUpdates}
      goToReleasePage={goToReleasePage}
      collapsed={collapsed}
      toggleCollapse={toggleCollapse}
      midgardUrl={midgardUrl}
      midgardMayaUrl={midgardMayaUrl}
      onChangeMidgardUrl={updateMidgardUrlHandler}
      onChangeMidgardMayaUrl={updateMidgardMayaUrlHandler}
      onChangeThornodeNodeUrl={setThornodeNodeUrl}
      onChangeThornodeRpcUrl={setThornodeRpcUrl}
      onChangeMayanodeNodeUrl={setMayanodeNodeUrl}
      onChangeMayanodeRpcUrl={setMayanodeRpcUrl}
      checkMidgardUrl$={checkMidgardUrl$}
      checkMidgardMayaUrl$={checkMidgardMayaUrl$}
      thornodeRpcUrl={thornodeRpcUrl}
      thornodeNodeUrl={thornodeNodeUrl}
      checkThornodeRpcUrl$={checkThornodeRpcUrl$}
      checkThornodeNodeUrl$={checkThornodeNodeUrl$}
      mayanodeRpcUrl={mayanodeRpcUrl}
      mayanodeNodeUrl={mayanodeNodeUrl}
      checkMayanodeRpcUrl$={checkMayanodeRpcUrl$}
      checkMayanodeNodeUrl$={checkMayanodeNodeUrl$}
    />
  )
}
