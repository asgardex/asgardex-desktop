import React from 'react'
import clsx from 'clsx'

import { LabelProps, sizeMap, colorMap } from './Label.types'

export const Label = React.forwardRef<HTMLDivElement, LabelProps>(
  (
    {
      align = 'left',
      size = 'normal',
      color = 'normal',
      disabled = false,
      weight = 'normal',
      textTransform = 'none',
      nowrap = false,
      loading = false,
      className,
      children,
      onClick
    },
    ref
  ): JSX.Element => {
    const baseClasses = clsx(
      'w-full p-0',
      sizeMap[size],
      colorMap[color],
      {
        'font-mainBold font-bold': weight === 'bold',
        'font-main font-normal': weight !== 'bold',
        uppercase: textTransform === 'uppercase',
        lowercase: textTransform === 'lowercase',
        capitalize: textTransform === 'capitalize',
        'whitespace-nowrap': nowrap,
        'whitespace-normal': !nowrap,
        'opacity-50': disabled,
        'cursor-pointer': !!onClick,
        'text-left': align === 'left',
        'text-center': align === 'center',
        'text-right': align === 'right'
      },
      className
    )

    return (
      <div ref={ref} className={baseClasses} onClick={onClick}>
        {loading ? <div className="h-4 w-full animate-pulse rounded bg-gray0 dark:bg-gray0d" /> : children}
      </div>
    )
  }
)
