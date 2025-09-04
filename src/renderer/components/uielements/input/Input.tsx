import React, { forwardRef, useCallback } from 'react'

import clsx from 'clsx'
import { function as FP } from 'fp-ts'

import type { Size } from './Input.types'

const sizeClasses: Record<Size, string> = {
  small: 'px-2 py-1 text-11',
  normal: 'px-3 py-1.5 text-14',
  large: 'px-4 py-2 text-16',
  xlarge: 'px-6 py-3 text-18'
}

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: Size // overridden
  id?: string
  error?: boolean
  uppercase?: boolean
  disabled?: boolean
  autoFocus?: boolean
  ghost?: boolean
  onEnter?: (value: string) => void
  onCancel?: FP.Lazy<void>
}

export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref): JSX.Element => {
  const {
    id = 'input-id',
    size = 'normal',
    ghost = false,
    disabled = false,
    autoFocus = false,
    uppercase = false,
    error = '',
    onEnter = FP.constVoid,
    onCancel = FP.constVoid,
    className = '',
    ...otherProps
  } = props

  const onKeyDownHandler = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value
      if (e.key === 'Enter') {
        onEnter(value)
      }
      if (e.key === 'Escape') {
        onCancel()
      }
    },
    [onEnter, onCancel]
  )

  return (
    <input
      ref={ref}
      id={id}
      autoFocus={autoFocus}
      className={clsx(
        'w-full rounded-lg appearance-none focus:outline-none',
        'bg-bg0 font-main dark:bg-bg0d',
        'placeholder:text-gray-300 dark:placeholder:text-gray-400',
        ghost ? 'ring-0' : 'ring-1',
        error ? 'ring-error0 dark:ring-error0d' : 'ring-gray1 dark:ring-gray1d',
        error ? 'text-error0 dark:text-error0d' : 'text-text0 dark:text-text0d',
        uppercase ? 'uppercase placeholder:uppercase' : 'normal-case',
        disabled ? 'opacity-50' : 'opacity-100',
        sizeClasses[size],
        className
      )}
      type="text"
      onKeyDown={onKeyDownHandler}
      autoComplete="off"
      disabled={disabled}
      {...otherProps}
    />
  )
})
