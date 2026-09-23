import clsx from 'clsx'
import { useIntl } from 'react-intl'

export const RunebondUnavailablePanel = ({ className }: { className?: string }) => {
  const intl = useIntl()

  return (
    <div
      className={clsx(
        'flex w-full items-center justify-center rounded-lg border border-dashed border-gray0 p-8 dark:border-gray0d',
        className
      )}>
      <span className="text-center font-main text-[14px] text-gray2 dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.provider.data.unavailable' })}
      </span>
    </div>
  )
}
