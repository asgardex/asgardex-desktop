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
        'font-bold': weight === 'bold',
        'font-normal': weight !== 'bold',
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
        {loading ? <div className="animate-pulse bg-gray-200 rounded h-4 w-full" /> : children}
      </div>
    )
  }
)
