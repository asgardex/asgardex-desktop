import clsx from 'clsx'

import type { ChartDateRange } from '../../../views/pools/detail/types'

const RANGES: ChartDateRange[] = ['7d', '30d']

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
          range === selected ? 'bg-turquoise text-white' : 'text-gray-400 hover:text-white'
        )}>
        {range}
      </button>
    ))}
  </div>
)
