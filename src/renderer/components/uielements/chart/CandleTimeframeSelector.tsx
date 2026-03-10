import clsx from 'clsx'

import type { CandleTimeframe } from '../../../views/pools/detail/types'

const TIMEFRAMES: CandleTimeframe[] = ['1H', '4H', '1D', '1W']

type Props = {
  selected: CandleTimeframe
  onChange: (tf: CandleTimeframe) => void
}

export const CandleTimeframeSelector = ({ selected, onChange }: Props) => (
  <div className="flex gap-1">
    {TIMEFRAMES.map((tf) => (
      <button
        key={tf}
        onClick={() => onChange(tf)}
        className={clsx(
          'text-12 rounded px-3 py-1 font-main transition-colors',
          tf === selected
            ? 'bg-turquoise text-bg0 dark:text-bg0d'
            : 'text-text2 hover:text-text0 dark:text-text2d dark:hover:text-text0d'
        )}>
        {tf}
      </button>
    ))}
  </div>
)
