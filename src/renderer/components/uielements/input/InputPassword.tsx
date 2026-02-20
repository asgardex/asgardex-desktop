import { forwardRef, useState } from 'react'

import clsx from 'clsx'

import { EyeHideIcon, EyeIcon } from '../../icons'
import { Input, InputProps } from './Input'

export type PasswordProps = { inputClassName?: string; error?: string } & Omit<InputProps, 'error' | 'uppercase'>

export const InputPassword = forwardRef<HTMLInputElement, PasswordProps>((props, ref): JSX.Element => {
  const { id = 'input-pw', disabled = false, error, className = '', inputClassName = '', ...otherProps } = props

  const [showPw, setShowPw] = useState(false)

  const Icon = showPw ? EyeIcon : EyeHideIcon

  return (
    <div className={className}>
      <div
        className={clsx(
          'flex w-full items-center rounded-lg border bg-bg0 dark:bg-bg0d',
          error ? 'border-error0 dark:border-error0d' : 'border-gray0 dark:border-gray0d'
        )}>
        <Input
          className={clsx('!border-0 placeholder:uppercase', inputClassName)}
          ref={ref}
          error={!!error}
          id={id}
          disabled={disabled}
          type={showPw ? 'text' : 'password'}
          autoComplete="off"
          uppercase={false}
          ghost
          {...otherProps}
        />
        <div
          className={clsx(
            'flex shrink-0 cursor-pointer items-center px-10px',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          )}
          onClick={() => {
            setShowPw((current) => !current)
          }}>
          <Icon className={clsx('h-20px w-20px', error ? 'text-error0' : 'text-gray1 dark:text-gray1d')} />
        </div>
      </div>
      {error && <p className="mt-2 font-main text-sm text-error0 uppercase">{error}</p>}
    </div>
  )
})
