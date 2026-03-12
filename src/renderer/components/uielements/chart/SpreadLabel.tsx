import clsx from 'clsx'
import { useIntl } from 'react-intl'

import type { SpreadInfo } from '../../../hooks/usePriceSpread'

type Props = {
  spread: SpreadInfo
}

const formatUSD = (value: number): string => {
  const fractionDigits = value >= 100 ? 0 : value >= 1 ? 2 : 4
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value)
}

export const SpreadLabel = ({ spread }: Props) => {
  const intl = useIntl()
  const { midgardPrice, binancePrice, chainflipPrice, spreadPct, spreadDirection } = spread

  const sign = spreadPct >= 0 ? '+' : ''
  const spreadText = `${sign}${spreadPct.toFixed(2)}%`

  return (
    <div className="text-12 flex flex-wrap items-center gap-x-3 gap-y-1 font-main">
      <span className="text-gray-400">
        {intl.formatMessage({ id: 'pools.chart.source.binance' })}: {formatUSD(binancePrice)}
      </span>
      <span className="text-gray-600">|</span>
      {chainflipPrice !== undefined && (
        <>
          <span className="text-gray-400">
            {intl.formatMessage({ id: 'pools.chart.source.chainflip' })}: {formatUSD(chainflipPrice)}
          </span>
          <span className="text-gray-600">|</span>
        </>
      )}
      <span className="text-gray-400">
        {intl.formatMessage({ id: 'pools.chart.source.midgard' })}: {formatUSD(midgardPrice)}
      </span>
      <span className="text-gray-600">|</span>
      <span
        className={clsx(
          spreadDirection === 'discount' && 'text-yellow-400',
          spreadDirection === 'premium' && 'text-red-400',
          spreadDirection === 'equal' && 'text-gray-400'
        )}>
        {intl.formatMessage({ id: 'pools.chart.spread' })}: {spreadText}
      </span>
    </div>
  )
}
