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
          'z-10 origin-top-right rounded-xl bg-bg0 dark:bg-bg0d p-2 border border-solid border-gray0 dark:border-gray0d text-sm/6 text-white transition duration-100 ease-out [--anchor-gap:--spacing(1)] focus:outline-none data-closed:scale-95 data-closed:opacity-0',
          className
        )}>
        {options.map((option, index) => (
          <MenuItem key={index}>
            <div className="cursor-pointer hover:bg-bg2 dark:hover:bg-bg2d rounded-lg">{option}</div>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  )
}
