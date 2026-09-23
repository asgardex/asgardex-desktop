import { forwardRef, useEffect, useState } from 'react'

import clsx from 'clsx'

import { EyeHideIcon, EyeIcon } from '../../icons'
import { Input, InputProps } from './Input'

export type PasswordProps = {
  inputClassName?: string
  error?: string
  /** Replaces the default error-text classes. */
  errorClassName?: string
  /** Increment to replay the red border flash (each failed submit). */
  errorPulse?: number
} & Omit<InputProps, 'error' | 'uppercase'>

export const InputPassword = forwardRef<HTMLInputElement, PasswordProps>((props, ref): JSX.Element => {
  const {
    id = 'input-pw',
    disabled = false,
    error,
    errorClassName = 'mt-2 font-main text-sm text-error0 uppercase',
    errorPulse = 0,
    className = '',
    inputClassName = '',
    ...otherProps
  } = props

  const [showPw, setShowPw] = useState(false)
  const [flashing, setFlashing] = useState(false)

  // Drop the class for a frame so a second failure replays the animation.
  useEffect(() => {
    if (!errorPulse || !error) {
      setFlashing(false)
      return
    }
    setFlashing(false)
    const start = window.requestAnimationFrame(() => setFlashing(true))
    const timer = window.setTimeout(() => setFlashing(false), 700)
    return () => {
      window.cancelAnimationFrame(start)
      window.clearTimeout(timer)
    }
  }, [errorPulse, error])

  const Icon = showPw ? EyeIcon : EyeHideIcon

  return (
    <div className={className}>
      <div
        className={clsx(
          'flex w-full items-center rounded-lg border bg-bg0 dark:bg-bg0d',
          error ? 'border-error0 dark:border-error0d' : 'border-gray0 dark:border-gray0d',
          flashing && 'password-error-flash'
        )}>
        <Input
          className={clsx('!border-0 placeholder:uppercase', flashing && '!bg-transparent', inputClassName)}
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
      {error && <p className={errorClassName}>{error}</p>}
    </div>
  )
})
