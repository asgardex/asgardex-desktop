import React from 'react'

import { array as A, function as FP } from 'fp-ts'

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

export const ActionButton = ({
  size,
  actions,
  isTextView = true,
  className = '',
  btnClassName = ''
}: Props): JSX.Element => {
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
