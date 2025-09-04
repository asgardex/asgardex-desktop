import React from 'react'

import clsx from 'clsx'

import { LoadingIcon } from '../../icons'
import type { Size, Font } from './Button.types'

export const iconSize: Record<Size, string> = {
  small: 'w-10px h-10px',
  medium: 'w-[14px] h-[14px]',
  normal: 'w-[17px] h-[17px]',
  large: 'w-[17px] h-[17px]'
}
export type BaseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: Size
  loading?: boolean
  uppercase?: boolean
  font?: Font
}

export const BaseButton = (props: BaseButtonProps): JSX.Element => {
  const {
    size = 'normal',
    loading = false,
    className = '',
    disabled = false,
    type = 'button',
    font = 'normal',
    uppercase = true, // by default all labels are uppercase in ASDGX
    children,
    ...restProps
  } = props

  const sizeClasses: Record<Size, string> = {
    small: 'px-[10px] py-[1px] text-[10px]',
    medium: 'px-[12px] py-[2px] text-[12px]',
    normal: 'px-4 py-1 text-[14px]',
    large: 'px-5 py-1 text-[16px]'
  }

  const iconMargin: Record<Size, string> = {
    small: 'mr-[4px]',
    medium: 'mr-[6px]',
    normal: 'mr-[8px]',
    large: 'mr-[12px]'
  }

  const fontFamily: Record<Font, string> = {
    normal: 'font-main',
    semi: 'font-mainSemiBold',
    bold: 'font-mainBold'
  }

  return (
    <button
      disabled={disabled}
      type={type}
      className={clsx(
        'group flex appearance-none items-center justify-center',
        'transition duration-300 ease-in-out',
        disabled ? 'opacity-60' : 'opcacity-100',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        uppercase ? 'uppercase' : 'normal-case',
        fontFamily[font],
        sizeClasses[size],
        className
      )}
      {...restProps}>
      {loading && (
        <LoadingIcon className={clsx(iconSize[size], iconMargin[size], 'animate-spin group-hover:opacity-70')} />
      )}
      {children}
    </button>
  )
}
