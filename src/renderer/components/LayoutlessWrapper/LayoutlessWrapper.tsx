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
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-bg1 dark:bg-bg1d">
      <div className="absolute top-4 left-4 z-10">
        <BackLinkButton />
      </div>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <LocaleDropdown />
        <HeaderTheme isDesktopView />
      </div>

      <div className="flex w-full max-w-[420px] flex-col p-4">
        <div className="mb-10 flex items-center">
          <Label align="center" size="large" textTransform="uppercase" weight="bold">
            {title}
          </Label>
        </div>

        {children}
      </div>
    </div>
  )
}
