import { ButtonProps as HeadlessButtonProps } from '@headlessui/react'

export type ButtonSize = 'small' | 'normal' | 'xnormal' | 'big'
export type ButtonColor = 'primary' | 'success' | 'warning' | 'error'
export type ButtonWeight = 'normal' | 'bold' | '500'
export type ButtonType = 'normal' | 'default' | 'outline' | 'ghost' | 'transparent' | 'underline'
export type ButtonRound = 'true' | 'false'

type ComponentProps = {
  sizevalue?: ButtonSize
  color?: ButtonColor
  weight?: ButtonWeight
  typevalue?: ButtonType
  focused?: boolean
  round?: ButtonRound
  children?: React.ReactNode
  className?: string
  loading?: boolean
}

export type ButtonProps = ComponentProps & HeadlessButtonProps

// Tailwind based button types
export type Size = 'small' | 'medium' | 'normal' | 'large'
export type Font = 'normal' | 'semi' | 'bold'
export type Color = 'primary' | 'warning' | 'error' | 'neutral'
