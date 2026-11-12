import { ReactNode } from 'react'

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import clsx from 'clsx'

import { SETTINGS_FOCUS_RING } from './settingsUi'

export type SettingsTab = {
  key: string
  label: ReactNode
  content: ReactNode
  disabled?: boolean
}

export type SettingsTabsProps = {
  tabs: SettingsTab[]
  defaultIndex?: number
  className?: string
  onChange?: (index: number) => void
}

/**
 * Settings-only segmented tab bar (same look as the pools toolbar filters).
 * Not a restyle of the shared `Tabs` component, which is also used by Deposit and WhitelistModal.
 */
export const SettingsTabs = ({ tabs, defaultIndex = 0, className, onChange }: SettingsTabsProps): JSX.Element => (
  <TabGroup className={clsx('flex flex-col gap-4', className)} defaultIndex={defaultIndex} onChange={onChange}>
    <TabList
      className="flex flex-wrap items-center gap-1 self-start rounded-lg bg-bg2 p-1 dark:bg-bg2d/50"
      data-testid="settings-tabs">
      {tabs.map(({ key, label, disabled }) => (
        <Tab
          key={key}
          disabled={disabled}
          className={({ selected }) =>
            clsx(
              'rounded-md px-2.5 py-1 font-main text-[12px] transition-colors',
              SETTINGS_FOCUS_RING,
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              selected
                ? 'bg-bg0 text-text0 shadow-sm dark:bg-bg2d dark:text-text0d'
                : 'text-text2 hover:text-text0 dark:text-text2d dark:hover:text-text0d'
            )
          }>
          {label}
        </Tab>
      ))}
    </TabList>
    <TabPanels>
      {tabs.map(({ key, content }) => (
        <TabPanel key={key} className="focus-visible:outline-none">
          {content}
        </TabPanel>
      ))}
    </TabPanels>
  </TabGroup>
)
