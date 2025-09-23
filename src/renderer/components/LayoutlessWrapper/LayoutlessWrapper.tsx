import React from 'react'
import { HeaderTheme } from '../header/theme'
import { BackLinkButton } from '../uielements/button'
import { Label } from '../uielements/label'
import { LocaleDropdown } from './LocaleDropdown'

type Props = {
  title: string
  children: React.ReactNode
}

export const LayoutlessWrapper = ({ title, children }: Props) => {
  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full bg-bg1 dark:bg-bg1d">
      <div className="absolute top-4 left-4 z-10">
        <BackLinkButton />
      </div>
      <div className="flex items-center gap-2 absolute top-4 right-4 z-10">
        <LocaleDropdown />
        <HeaderTheme isDesktopView />
      </div>

      <div className="flex flex-col p-4 w-full max-w-[420px]">
        <div className="flex items-center mb-10">
          <Label align="center" size="large" textTransform="uppercase" weight="bold">
            {title}
          </Label>
        </div>

        {children}
      </div>
    </div>
  )
}
