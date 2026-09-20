import { ChartBarIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

export const RunebondPendingPanel = ({ className }: { className?: string }) => {
  const intl = useIntl()

  return (
    <div
      className={clsx(
        'flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-gray0 p-8 dark:border-gray0d',
        className
      )}>
      <ChartBarIcon className="h-8 w-8 text-gray2 dark:text-gray2d" />
      <span className="mt-3 font-main-semi-bold text-[16px] text-text0 dark:text-text0d">
        {intl.formatMessage({ id: 'bonds.provider.data.unavailable' })}
      </span>
      <span className="mt-1 max-w-[420px] text-center font-main text-[14px] text-gray2 dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.provider.data.unavailable.desc' })}
      </span>
    </div>
  )
}
