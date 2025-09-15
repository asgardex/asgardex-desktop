import React from 'react'

import clsx from 'clsx'
import { LoadingIcon } from '../../icons'
import { ButtonWrapper } from './Button.styles'
import type { ButtonProps } from './Button.types'

// TODO (@veado) Extract/Rename to LegacyButton.tsx to remove it in the near future
export const Button: React.ForwardRefExoticComponent<ButtonProps> = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const {
      children,
      sizevalue = 'normal',
      color = 'primary',
      typevalue = 'default',
      weight = '500',
      round = 'false',
      focused = false,
      className = '',
      loading = false,
      ...otherProps
    } = props

    const focusedStyle = focused ? 'focused' : ''

    return (
      <ButtonWrapper
        ref={ref}
        className={clsx(className, 'btn-wrapper', focusedStyle)}
        weight={weight}
        color={color}
        sizevalue={sizevalue}
        typevalue={typevalue}
        round={round}
        {...otherProps}>
        {loading ? <LoadingIcon className="w-4 h-4 animate-spin group-hover:opacity-70" /> : children}
        {props.typevalue === 'normal' && <div className="borderBottom" />}
      </ButtonWrapper>
    )
  }
)
