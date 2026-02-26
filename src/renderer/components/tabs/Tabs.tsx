import React, { Fragment } from 'react'

import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react'

import clsx from 'clsx'
import { Label } from '../uielements/label'

type Props = {
  className?: string
  tabs: { label: React.ReactNode; key: string; content: React.ReactNode; disabled?: boolean }[]
  hasPadding?: boolean
  defaultIndex?: number
  onChange?: (tabKey: number) => void
}

export const Tabs = ({
  tabs,
  defaultIndex = 0,
  hasPadding = false,
  className,
  onChange = (_: number) => {}
}: Props): JSX.Element => {
  return (
    <TabGroup className={clsx('flex flex-col', className)} defaultIndex={defaultIndex} onChange={onChange}>
      <TabList className="flex justify-center gap-4 border-b border-solid border-gray0 dark:border-gray0d">
        {tabs.map(({ key, label, disabled }) => (
          <Tab key={key} as={Fragment} disabled={disabled}>
            {({ hover, selected }) => (
              <div className={clsx('flex flex-col outline-hidden', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                <Label
                  className="!w-auto p-6 !text-16 !leading-5"
                  color={hover || selected ? 'primary' : 'dark'}
                  weight="bold"
                  textTransform="uppercase">
                  {label}
                </Label>
                {selected && <div className="h-0.5 w-full bg-turquoise" />}
              </div>
            )}
          </Tab>
        ))}
      </TabList>
      <TabPanels>
        {tabs.map(({ key, content }) => (
          <TabPanel key={key}>
            <div className={hasPadding ? 'p-8' : 'p-0'}>{content}</div>
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  )
}
