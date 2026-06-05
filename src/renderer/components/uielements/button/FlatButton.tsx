import clsx from 'clsx'
import { BaseButton, BaseButtonProps } from './BaseButton'
import * as S from './Button.shared'
import type { Color } from './Button.types'

export type Props = BaseButtonProps & {
  color?: Color
}

export const FlatButton = (props: Props): JSX.Element => {
  const { color = 'primary', size = 'normal', disabled = false, className = '', children, ...restProps } = props

  const bgColor: Record<Color, string> = {
    primary: 'bg-turquoise',
    warning: 'bg-warning0 dark:bg-warning0d',
    error: 'bg-error0 dark:bg-error0d',
    neutral: 'bg-gray0 dark:bg-gray0d',
    // Outline style — transparent fill so the affordance reads as "available
    // but cautioned" rather than as a primary action.
    impaired: 'bg-transparent'
  }

  const textColor: Record<Color, string> = {
    primary: 'text-white',
    warning: 'text-white',
    error: 'text-white',
    neutral: 'text-text0 dark:text-text0d',
    impaired: 'text-impaired dark:text-impairedd'
  }

  const borderColor = { ...S.borderColor, neutral: 'border-gray0 dark:border-gray0d' }

  return (
    <BaseButton
      size={size}
      disabled={disabled}
      className={clsx(
        'rounded-full',
        textColor[color],
        bgColor[color],
        S.borderSize[size],
        borderColor[color],
        !disabled ? `hover:${S.dropShadow[size]} hover:scale-105 hover:opacity-85` : '',
        className
      )}
      {...restProps}>
      {children}
    </BaseButton>
  )
}
