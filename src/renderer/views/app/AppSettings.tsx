import { useMemo } from 'react'

import { useIntl } from 'react-intl'

import { WalletSettingsAuth } from '../wallet/WalletSettingsAuth'
import { AppExpertModeView } from './AppExpertModeView'
import { AppGeneralSettingsView } from './AppGeneralSettingsView'
import * as Styled from './AppSettings.styles'

export const AppSettings = () => {
  const intl = useIntl()

  const tabs = useMemo(
    () => [
      {
        key: 'settings-general',
        disabled: false,
        label: intl.formatMessage({ id: 'common.general' }),
        content: <AppGeneralSettingsView />
      },
      {
        key: 'settings-wallet',
        disabled: false,
        label: intl.formatMessage({ id: 'common.wallet' }),
        content: <WalletSettingsAuth />
      },
      {
        key: 'settings-expert',
        disabled: false,
        // TODO: add locale
        label: 'Expert Mode',
        content: <AppExpertModeView />
      }
    ],
    [intl]
  )

  return (
    <div className="mt-50px flex-row rounded-lg bg-bg0 dark:bg-bg0d">
      <Styled.Tabs className="rounded-lg" destroyInactiveTabPane tabs={tabs} defaultActiveKey="settings-general" />
    </div>
  )
}
