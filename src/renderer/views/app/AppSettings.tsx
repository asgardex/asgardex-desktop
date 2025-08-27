import { useMemo } from 'react'

import { useIntl } from 'react-intl'

import { Tabs } from '../../components/tabs'
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
        label: 'DEX',
        content: <AppDexSettingsView />
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
    <div className="flex-row rounded-lg bg-bg0 dark:bg-bg0d">
      <Tabs className="rounded-lg" tabs={tabs} defaultIndex={0} />
    </div>
  )
}
