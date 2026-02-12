/* eslint-disable import/no-unresolved */
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { AnchorProps } from '@headlessui/react/dist/internal/floating'
import clsx from 'clsx'

type Props = {
  className?: string
  trigger: React.ReactNode
  options: React.ReactNode[]
  anchor?: AnchorProps
}

export const Dropdown = ({
  className,
  trigger,
  options,
  anchor = { to: 'bottom start', gap: 4, padding: 8 }
}: Props) => {
  return (
    <Menu>
      <MenuButton>{trigger}</MenuButton>
      <MenuItems
        transition
        anchor={anchor}
        className={clsx(
          'z-10 origin-top-right rounded-xl border border-solid border-gray0 bg-bg0 p-2 text-sm/6 text-white transition duration-100 ease-out [--anchor-gap:--spacing(1)] focus:outline-hidden data-closed:scale-95 data-closed:opacity-0 dark:border-gray0d dark:bg-bg0d',
          className
        )}>
        {options.map((option, index) => (
          <MenuItem key={index}>
            <div className="cursor-pointer rounded-lg hover:bg-bg2 dark:hover:bg-bg2d">{option}</div>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  )
}
