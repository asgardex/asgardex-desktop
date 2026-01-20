import React from 'react'

import { Button as HeadlessButton } from '@headlessui/react'
import clsx from 'clsx'

import { LoadingIcon } from '../../icons'
import type { ButtonProps } from './Button.types'

// Tailwind class mappings for button properties
const textClasses = {
  small: 'text-[10px] tracking-[0.5px]',
  normal: 'text-[11px] tracking-[2.5px]',
  xnormal: 'text-[16px] tracking-[2.5px]',
  big: 'text-[21px] tracking-[3px]'
}

const sizeClasses = {
  small: 'px-3 py-1 min-w-[48px]',
  normal: 'px-4 py-2 min-w-[96px]',
  xnormal: 'px-5 py-2.5 min-w-[192px]',
  big: 'px-6 py-3 min-w-[300px]'
}

const colorClasses = {
  primary: 'bg-turquoise text-white hover:bg-turquoise/90 border-turquoise',
  success: 'bg-turquoise text-white hover:bg-green-600 border-turquoise',
  warning: 'bg-warning0 dark:bg-warning0d text-white hover:opacity-90 border-warning0 dark:border-warning0d',
  error: 'bg-error0 dark:bg-error0d text-white hover:opacity-90 border-error0 dark:border-error0d'
}

const typeClasses = {
  normal: 'border-b',
  default: 'border',
  outline: 'bg-transparent! border',
  ghost: 'bg-transparent! border-0 hover:bg-gray-100 dark:hover:bg-gray-800',
  transparent: 'bg-transparent! border-0 text-text0! dark:text-text0d!',
  underline: 'bg-transparent! border-0 border-b hover:border-b'
}

const weightClasses = {
  normal: 'font-normal',
  bold: 'font-bold',
  '500': 'font-medium'
}

// TODO (@veado) Extract/Rename to LegacyButton.tsx to remove it in the near future
export const Button: React.ForwardRefExoticComponent<ButtonProps> = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const {
      children,
      sizevalue = 'normal',
      color = 'primary',
      typevalue = 'default',
      weight = '500',
      round = 'false',
      focused = false,
      className = '',
      loading = false,
      ...otherProps
    } = props

    const focusedStyle = focused ? 'focused' : ''

    return (
      <HeadlessButton
        ref={ref}
        className={clsx(
          'btn-wrapper flex items-center justify-around uppercase',
          round === 'true' ? 'rounded-full' : '',
          'disabled:cursor-not-allowed disabled:opacity-50',
          textClasses[sizevalue],
          sizeClasses[sizevalue],
          colorClasses[color],
          typeClasses[typevalue],
          weightClasses[weight],
          focusedStyle,
          className
        )}
        {...otherProps}>
        {loading ? <LoadingIcon className="h-4 w-4 animate-spin group-hover:opacity-70" /> : children}
      </HeadlessButton>
    )
  }
)
