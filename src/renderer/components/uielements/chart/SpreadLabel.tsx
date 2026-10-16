import { useIntl } from 'react-intl'

import type { SpreadInfo } from '../../../hooks/usePriceSpread'

type Props = {
  spread: SpreadInfo
}

export const formatChartUsd = (value: number): string => {
  const fractionDigits = value >= 100 ? 0 : value >= 1 ? 2 : 4
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value)
}

const Chip = ({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-main text-11">
    <span className="text-gray-500">{label}</span>
    <span className={valueClassName ?? 'text-gray-200'}>{value}</span>
  </span>
)

export const SpreadLabel = ({ spread }: Props) => {
  const intl = useIntl()
  const { midgardPrice, binancePrice, chainflipPrice, spreadPct, spreadDirection } = spread

  const sign = spreadPct >= 0 ? '+' : ''
  const spreadText = `${sign}${spreadPct.toFixed(2)}%`
  const spreadClass =
    spreadDirection === 'discount'
      ? 'text-yellow-400'
      : spreadDirection === 'premium'
        ? 'text-red-400'
        : 'text-gray-400'

  return (
    <>
      <Chip label={intl.formatMessage({ id: 'pools.chart.source.binance' })} value={formatChartUsd(binancePrice)} />
      {chainflipPrice !== undefined && (
        <Chip
          label={intl.formatMessage({ id: 'pools.chart.source.chainflip' })}
          value={formatChartUsd(chainflipPrice)}
        />
      )}
      <Chip label={intl.formatMessage({ id: 'pools.chart.source.midgard' })} value={formatChartUsd(midgardPrice)} />
      <Chip label={intl.formatMessage({ id: 'pools.chart.spread' })} value={spreadText} valueClassName={spreadClass} />
    </>
  )
}
