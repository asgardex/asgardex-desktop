export type Size = 'tiny' | 'small' | 'normal' | 'big' | 'large'
export type Color =
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'normal'
  | 'light'
  | 'dark'
  | 'gray'
  | 'input'
  | 'white'
export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize'
export type TextAlignment = 'left' | 'center' | 'right'

export type LabelProps = {
  align?: TextAlignment
  size?: Size
  color?: Color
  disabled?: boolean
  weight?: 'normal' | 'bold'
  textTransform?: TextTransform
  nowrap?: boolean
  loading?: boolean
  className?: string
  children?: React.ReactNode
  onClick?: (_: React.MouseEvent<HTMLElement>) => void
}

export const sizeMap: Record<Size, string> = {
  tiny: 'text-[8px] tracking-[0.36px]',
  small: 'text-[11px] tracking-[0.42px]',
  normal: 'text-[12px] tracking-[1px]',
  big: 'text-[14px] tracking-[1px]',
  large: 'text-[18px] tracking-[1px]'
}

export const colorMap: Record<Color, string> = {
  primary: 'text-turquoise',
  success: 'text-turquoise',
  warning: 'text-warning0 dark:text-warning0d',
  error: 'text-error0 dark:text-error0d',
  normal: 'text-text0 dark:text-text0d',
  light: 'text-text2 dark:text-text2d',
  dark: 'text-text1 dark:text-text1d',
  gray: 'text-text2 dark:text-text2d',
  input: 'text-text2 dark:text-text2d',
  white: 'text-white'
}
