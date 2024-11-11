import React from 'react'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import * as FP from 'fp-ts/function'
import { useIntl } from 'react-intl'

import { iconSize } from './BaseButton'
import type { Color, Size } from './Button.types'
import { TextButton } from './TextButton'

export type Props = {
  label?: string
  color?: Color
  onClick?: React.MouseEventHandler<HTMLElement>
  size?: Size
  disabled?: boolean
  className?: string
}

/**
 * Refresh Button - a `TextButton` w/ an ReloadIcon
 */
export const RefreshButton: React.FC<Props> = (props): JSX.Element => {
  const { label, size = 'normal', color = 'primary', onClick = FP.constVoid, disabled, className = '' } = props
  const intl = useIntl()

  return (
    <TextButton
      className={clsx('group !p-0', className)}
      size={size}
      color={color}
      onClick={onClick}
      disabled={disabled}>
      <ArrowPathIcon className={clsx('ease mr-5px text-inherit group-hover:rotate-180', iconSize[size])} />
      <span className="hidden sm:inline-block">{label || intl.formatMessage({ id: 'common.refresh' })}</span>
    </TextButton>
  )
}
