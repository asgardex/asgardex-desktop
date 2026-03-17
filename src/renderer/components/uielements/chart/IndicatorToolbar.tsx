import { useCallback, useState } from 'react'

import clsx from 'clsx'
import { useIntl } from 'react-intl'

import type { IndicatorConfig, IndicatorType } from '../../../views/pools/detail/types'

/** Return dark or light text based on hex background luminance */
const textColorForBg = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  // Perceived brightness (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1e222d' : '#ffffff'
}

type Props = {
  indicators: IndicatorConfig[]
  onChange: (indicators: IndicatorConfig[]) => void
}

const INDICATOR_LABELS: Record<IndicatorType, string> = {
  SMA: 'pools.chart.indicator.sma',
  EMA: 'pools.chart.indicator.ema',
  BB: 'pools.chart.indicator.bb'
}

export const IndicatorToolbar = ({ indicators, onChange }: Props) => {
  const intl = useIntl()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const toggleIndicator = useCallback(
    (index: number) => {
      const updated = indicators.map((ind, i) => (i === index ? { ...ind, enabled: !ind.enabled } : ind))
      onChange(updated)
    },
    [indicators, onChange]
  )

  const updatePeriod = useCallback(
    (index: number, period: number) => {
      if (period < 2 || period > 200) return
      const updated = indicators.map((ind, i) => (i === index ? { ...ind, period } : ind))
      onChange(updated)
    },
    [indicators, onChange]
  )

  return (
    <div className="flex items-center gap-1">
      {indicators.map((ind, i) => (
        <div key={ind.type} className="flex items-center">
          <button
            onClick={() => toggleIndicator(i)}
            onDoubleClick={() => setEditingIndex(editingIndex === i ? null : i)}
            className={clsx(
              'text-12 rounded px-2 py-1 font-main transition-colors',
              ind.enabled ? '' : 'text-gray-400 hover:text-white'
            )}
            style={ind.enabled ? { backgroundColor: ind.color, color: textColorForBg(ind.color) } : undefined}>
            {intl.formatMessage({ id: INDICATOR_LABELS[ind.type] })} {ind.period}
          </button>
          {editingIndex === i && (
            <input
              type="number"
              min={2}
              max={200}
              value={ind.period}
              onChange={(e) => updatePeriod(i, parseInt(e.target.value, 10))}
              onBlur={() => setEditingIndex(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingIndex(null)}
              autoFocus
              className="text-12 ml-1 w-12 rounded border border-gray-600 bg-[#1e222d] px-1 py-0.5 text-center font-main text-white"
            />
          )}
        </div>
      ))}
    </div>
  )
}
