import { ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { reloadRunebond } from '../../../services/runebond'
import { Tooltip } from '../../uielements/tooltip'

type Props = {
  loading: boolean
  disabled?: boolean
  className?: string
}

export const RunebondRefreshButton = ({ loading, disabled = false, className }: Props) => {
  const intl = useIntl()
  const label = intl.formatMessage({ id: 'bonds.runebond.refresh' })
  return (
    <Tooltip title={label}>
      <button
        type="button"
        aria-label={label}
        aria-busy={loading}
        disabled={loading || disabled}
        onClick={reloadRunebond}
        className={clsx(
          'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-gray2 transition-colors dark:text-gray2d',
          'hover:text-turquoise focus-visible:text-turquoise focus-visible:outline focus-visible:outline-1 focus-visible:outline-turquoise',
          'disabled:cursor-default disabled:hover:text-gray2 dark:disabled:hover:text-gray2d',
          className
        )}>
        <ArrowPathIcon className={clsx('h-4 w-4', loading && 'animate-spin')} />
      </button>
    </Tooltip>
  )
}
