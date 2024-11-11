import React from 'react'

import clsx from 'clsx'

import { BaseButton, BaseButtonProps } from './BaseButton'
import type { Color } from './Button.types'

export type Props = BaseButtonProps & {
  color?: Color
}

export const TextButton: React.FC<Props> = (props): JSX.Element => {
  const { color = 'primary', disabled = false, className = '', children, ...otherProps } = props

  const textColor: Record<Color, string> = {
    primary: 'text-turquoise',
    warning: 'text-warning0',
    error: 'text-error0',
    neutral: 'text-text0 dark:text-text0d'
  }

  return (
    <BaseButton
      color={color}
      disabled={disabled}
      className={clsx('bg-transparent', textColor[color], { 'hover:opacity-80': !disabled }, className)}
      {...otherProps}>
      {children}
    </BaseButton>
  )
}
