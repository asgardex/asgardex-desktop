import React, { forwardRef, useState } from 'react'

import clsx from 'clsx'

import { EyeHideIcon, EyeIcon } from '../../icons'
import { Input, InputProps } from './Input'

export type PasswordProps = { inputClassName?: string; error: string } & Omit<InputProps, 'error' | 'uppercase'>

export const InputPassword = forwardRef<HTMLInputElement, PasswordProps>((props, ref): JSX.Element => {
  const { id = 'input-pw', disabled = false, error = false, className = '', inputClassName = '', ...otherProps } = props

  const [showPw, setShowPw] = useState(false)

  const Icon = showPw ? EyeIcon : EyeHideIcon

  return (
    <div className={`${className}`}>
      <div className="relative w-full">
        <div className="bg:bg0 dark:bg:bg0d absolute right-0 flex h-full cursor-pointer items-center px-10px">
          <Icon
            className={`h-20px w-20px
            ${error ? 'text-error0' : 'text-gray1 dark:text-gray1d'}
            ${disabled ? 'opacity-50' : ''}
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
            onClick={() => {
              setShowPw((current) => !current)
            }}
          />
        </div>
        <Input
          className={clsx('placeholder:uppercase', inputClassName)}
          ref={ref}
          error={!!error}
          id={id}
          disabled={disabled}
          type={showPw ? 'text' : 'password'}
          autoComplete="off"
          uppercase={false}
          {...otherProps}
        />
      </div>
      {error && <p className="mt-2 font-main text-sm uppercase text-error0">{error}</p>}
    </div>
  )
})
