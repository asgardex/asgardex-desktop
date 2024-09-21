import React, { useState } from 'react'

import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export type Props = {
  className?: string
  header: React.ReactNode
  children: React.ReactNode
}

export const Collapse = ({ className, header, children }: Props): JSX.Element => {
  const [isShowing, setIsShowing] = useState(false)

  return (
    <div
      className={clsx(
        'flex flex-col overflow-hidden rounded-lg border border-solid border-gray1 dark:border-gray0d',
        className
      )}>
      <div
        className="flex cursor-pointer flex-row items-center justify-between py-2 px-4"
        onClick={() => {
          setIsShowing((prev) => !prev)
        }}>
        {header}
        <ChevronDownIcon
          className={`ease h-20px w-20px text-turquoise ${isShowing ? 'rotate-180' : 'rotate-0'}
            `}
        />
      </div>
      <div className={clsx('content transition-all duration-300 ease-in-out', isShowing ? 'max-h-[480px]' : 'max-h-0')}>
        {children}
      </div>
    </div>
  )
}
