import React from 'react'

import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'

import type { Props as ButtonProps } from './FlatButton'
import { FlatButton } from './index'

export type Action = {
  label: string
  callback: FP.Lazy<void>
  disabled?: boolean
}

export type Props = Omit<ButtonProps, 'onClick'> & {
  actions: Action[]
  btnClassName?: string
  isTextView?: boolean
}

export const ActionButton: React.FC<Props> = (props): JSX.Element => {
  const { size, actions, isTextView = true, className = '', btnClassName = '' } = props

  return (
    <div className={`flex w-full justify-start space-x-2 ${className}`}>
      {FP.pipe(
        actions,
        A.mapWithIndex((index, { label, callback, disabled = false }) => (
          <FlatButton
            className={`group ${btnClassName}`} // Use FlatButton or TextButton as needed
            size={size}
            disabled={disabled}
            key={index}
            onClick={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
              event.preventDefault()
              event.stopPropagation()
              callback()
            }}>
            {isTextView && <span>{label}</span>}
          </FlatButton>
        ))
      )}
    </div>
  )
}
