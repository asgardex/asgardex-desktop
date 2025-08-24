import { InformationCircleIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'

import { Tooltip } from '../tooltip'

type Color = 'primary' | 'warning' | 'error' | 'neutral'

export const iconColor: Record<Color, string> = {
  primary: 'text-turquoise',
  warning: 'text-warning0 dark:text-warning0d',
  error: 'text-error0 dark:text-error0d',
  neutral: 'text-text0 dark:text-text0d'
}

export type Props = {
  tooltip: string
  color?: Color
  className?: string
}

export const InfoIcon = ({ tooltip, color = 'primary', className = '' }: Props) => (
  <Tooltip title={tooltip}>
    <InformationCircleIcon className={clsx(iconColor[color], 'h-4 w-4', className)} />
  </Tooltip>
)
