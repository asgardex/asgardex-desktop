import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { BaseButton } from '../../uielements/button'
import { SegmentedTabOption, SegmentedTabs } from './SegmentedTabs'

type Props<T extends string> = {
  title: string
  refreshing: boolean
  onRefresh: () => void
  onAddNode: () => void
  toggle?: {
    options: SegmentedTabOption<T>[]
    value: T
    onChange: (value: T) => void
  }
  className?: string
}

export const OperatorDashboardTitleRow = <T extends string>({
  title,
  refreshing,
  onRefresh,
  onAddNode,
  toggle,
  className
}: Props<T>) => {
  const intl = useIntl()

  return (
    <div className={clsx('flex w-full flex-wrap items-center justify-between gap-3', className)}>
      <span className="font-main-semi-bold text-[12px] tracking-[2px] whitespace-nowrap text-gray2 uppercase dark:text-gray2d">
        {title}
      </span>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-[10px]">
        <BaseButton
          size="medium"
          font="semi"
          className="h-10 rounded-full border border-solid border-gray0 bg-bg0 !px-4 !py-0 tracking-[1px] whitespace-nowrap text-gray2 uppercase hover:text-turquoise dark:border-gray0d dark:bg-bg0d dark:text-gray2d dark:hover:text-turquoise"
          disabled={refreshing}
          onClick={onRefresh}>
          <ArrowPathIcon className={clsx('mr-2 h-[14px] w-[14px] text-inherit', refreshing && 'animate-spin')} />
          {intl.formatMessage({ id: refreshing ? 'bonds.operator.refreshing' : 'common.refresh' })}
        </BaseButton>
        <BaseButton
          size="medium"
          font="semi"
          className="h-10 rounded-full border border-solid border-gray0 bg-bg0 !px-4 !py-0 tracking-[1px] whitespace-nowrap text-gray2 uppercase hover:text-turquoise dark:border-gray0d dark:bg-bg0d dark:text-gray2d dark:hover:text-turquoise"
          onClick={onAddNode}>
          <PlusIcon className="mr-2 h-[13px] w-[13px] stroke-[2.6] text-inherit" />
          {intl.formatMessage({ id: 'bonds.node.add' })}
        </BaseButton>
        {toggle && (
          <SegmentedTabs
            className="rounded-full border border-solid border-gray0 bg-bg0 p-1 dark:border-gray0d dark:bg-bg0d"
            options={toggle.options}
            value={toggle.value}
            onChange={toggle.onChange}
          />
        )}
      </div>
    </div>
  )
}
