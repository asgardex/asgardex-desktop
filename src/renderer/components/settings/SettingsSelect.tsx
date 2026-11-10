import { ReactNode } from 'react'

import { AnchorProps } from '@headlessui/react/dist/internal/floating'
import clsx from 'clsx'

import { DownIcon } from '../icons'
import { Dropdown } from '../uielements/dropdown'

export type SettingsSelectProps = {
  value: ReactNode
  options: ReactNode[]
  valueClassName?: string
  className?: string
  triggerClassName?: string
  anchor?: AnchorProps
}

/**
 * Settings dropdown trigger: rounded-lg border, turquoise focus ring (via focus-within on the MenuButton).
 */
export const SettingsSelect = ({
  value,
  options,
  valueClassName,
  className,
  triggerClassName,
  anchor
}: SettingsSelectProps): JSX.Element => (
  <div
    className={clsx('rounded-lg focus-within:ring-2 focus-within:ring-turquoise focus-within:outline-none', className)}>
    <Dropdown
      anchor={anchor}
      trigger={
        <div
          className={clsx(
            'flex min-w-[240px] cursor-pointer items-center justify-between rounded-lg border border-gray0 bg-bg0 px-3 py-2 dark:border-gray0d dark:bg-bg0d',
            triggerClassName
          )}>
          <span className={clsx('font-main text-[14px] leading-5 text-text0 dark:text-text0d', valueClassName)}>
            {value}
          </span>
          <DownIcon />
        </div>
      }
      options={options}
    />
  </div>
)
