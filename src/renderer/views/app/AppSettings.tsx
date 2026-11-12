import { useMemo } from 'react'

import { useIntl } from 'react-intl'

import { SettingsTabs } from '../../components/settings'
import { WalletSettingsAuth } from '../wallet/WalletSettingsAuth'
import { AppDexSettingsView } from './AppDexSettingsView'
import { AppExpertModeView } from './AppExpertModeView'
import { AppGeneralSettingsView } from './AppGeneralSettingsView'

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
        key: 'settings-dex',
        disabled: false,
        label: intl.formatMessage({ id: 'settings.tab.dex' }),
        content: <AppDexSettingsView />
      },
      {
        key: 'settings-expert',
        disabled: false,
        label: intl.formatMessage({ id: 'settings.tab.expert' }),
        content: <AppExpertModeView />
      }
    ],
    [intl]
  )

  return (
    <div className="rounded-lg bg-bg0 p-4 dark:bg-bg0d">
      <SettingsTabs tabs={tabs} defaultIndex={0} />
    </div>
  )
}
