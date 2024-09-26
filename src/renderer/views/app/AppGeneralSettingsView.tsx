import React, { useCallback } from 'react'

import { useObservableState } from 'observable-hooks'

import { ExternalUrl } from '../../../shared/const'
import { DEFAULT_LOCALE } from '../../../shared/i18n/const'
import { envOrDefault } from '../../../shared/utils/env'
import { AppGeneralSettings } from '../../components/settings/AppGeneralSettings'
import { useI18nContext } from '../../contexts/I18nContext'
import { useAppUpdate } from '../../hooks/useAppUpdate'
import { useDex } from '../../hooks/useDex'
import { useNetwork } from '../../hooks/useNetwork'

export const AppGeneralSettingsView: React.FC = (): JSX.Element => {
  const { network, changeNetwork } = useNetwork()
  const { dex, changeDex } = useDex()
  const { appUpdater, checkForUpdates } = useAppUpdate()

  const { changeLocale, locale$ } = useI18nContext()
  const currentLocale = useObservableState(locale$, DEFAULT_LOCALE)

  const goToReleasePage = useCallback(
    (version: string) => window.apiUrl.openExternal(`${ExternalUrl.GITHUB_RELEASE}${version}`),
    []
  )

  return (
    <AppGeneralSettings
      locale={currentLocale}
      changeLocale={changeLocale}
      network={network}
      dex={dex}
      changeNetwork={changeNetwork}
      changeDex={changeDex}
      version={envOrDefault($VERSION, '-')}
      appUpdateState={appUpdater}
      checkForUpdates={checkForUpdates}
      goToReleasePage={goToReleasePage}
    />
  )
}
