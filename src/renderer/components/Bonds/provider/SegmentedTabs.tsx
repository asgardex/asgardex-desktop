import clsx from 'clsx'

import { BaseButton } from '../../uielements/button'
import { Tooltip } from '../../uielements/tooltip'

export type SegmentedTabOption<T extends string> = {
  label: string
  value: T
  disabled?: boolean
  tooltip?: string
}

type Props<T extends string> = {
  options: SegmentedTabOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export const SegmentedTabs = <T extends string>({ options, value, onChange, className }: Props<T>) => (
  <div className={clsx('flex items-center gap-1', className)}>
    {options.map((option) => {
      const isActive = option.value === value
      const button = (
        <BaseButton
          className={clsx(
            'rounded-full !px-4 !py-2 font-main-semi-bold text-[12px] tracking-[1px]',
            isActive && 'bg-turquoise text-white',
            !isActive && !option.disabled && 'text-gray2 hover:text-turquoise dark:text-gray2d',
            option.disabled && 'cursor-not-allowed text-gray2 opacity-60 dark:text-gray2d'
          )}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}>
          {option.label}
        </BaseButton>
      )

      return (
        <div key={option.value}>{option.tooltip ? <Tooltip title={option.tooltip}>{button}</Tooltip> : button}</div>
      )
    })}
  </div>
)
