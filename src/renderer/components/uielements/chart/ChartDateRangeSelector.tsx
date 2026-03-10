import clsx from 'clsx'

import type { ChartDateRange } from '../../../views/pools/detail/types'

const RANGES: ChartDateRange[] = ['7d', '30d', '90d', '180d', '365d']

type Props = {
  selected: ChartDateRange
  onChange: (range: ChartDateRange) => void
}

export const ChartDateRangeSelector = ({ selected, onChange }: Props) => (
  <div className="flex gap-1">
    {RANGES.map((range) => (
      <button
        key={range}
        onClick={() => onChange(range)}
        className={clsx(
          'text-12 rounded px-3 py-1 font-main transition-colors',
          range === selected
            ? 'bg-turquoise text-bg0 dark:text-bg0d'
            : 'text-text2 hover:text-text0 dark:text-text2d dark:hover:text-text0d'
        )}>
        {range}
      </button>
    ))}
  </div>
)
