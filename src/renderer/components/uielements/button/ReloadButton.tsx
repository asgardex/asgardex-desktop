import React from 'react'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import * as FP from 'fp-ts/function'
import { useIntl } from 'react-intl'

import { iconSize } from './BaseButton'
import type { Color, Size } from './Button.types'
import { FlatButton } from './FlatButton'

export type Props = {
  label?: string
  onClick?: React.MouseEventHandler<HTMLElement>
  size?: Size
  color?: Color
  disabled?: boolean
  className?: string
}

/**
 * `ReloadButton` - a `FlatButton` w/ an ReloadIcon
 */
export const ReloadButton: React.FC<Props> = (props): JSX.Element => {
  const { label, size = 'normal', color = 'primary', onClick = FP.constVoid, disabled, className = '' } = props
  const intl = useIntl()

  return (
    <FlatButton
      className={clsx('group !pl-10px', className)}
      size={size}
      color={color}
      onClick={onClick}
      disabled={disabled}>
      <ArrowPathIcon className={clsx('ease mr-5px text-inherit group-hover:rotate-180', iconSize[size])} />
      <span className="hidden sm:inline-block">{label || intl.formatMessage({ id: 'common.reload' })}</span>
    </FlatButton>
  )
}
