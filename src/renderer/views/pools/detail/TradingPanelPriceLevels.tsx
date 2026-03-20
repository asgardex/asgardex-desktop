import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import type { PriceLevel } from '../../../services/priceLevel/types'

type Props = {
  levels: PriceLevel[]
  onRemove: (levelId: string) => void
}

const STATUS_KEY: Record<PriceLevel['status'], string> = {
  pending: 'pools.chart.tradingPanel.priceLevel.pending',
  triggered: 'pools.chart.tradingPanel.priceLevel.triggered',
  confirming: 'pools.chart.tradingPanel.priceLevel.triggered',
  executing: 'pools.chart.tradingPanel.priceLevel.triggered',
  completed: 'pools.chart.tradingPanel.priceLevel.completed',
  failed: 'pools.chart.tradingPanel.priceLevel.failed'
}

const STATUS_STYLE: Record<PriceLevel['status'], string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  triggered: 'bg-yellow-500/20 text-yellow-400',
  confirming: 'bg-yellow-500/20 text-yellow-400',
  executing: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-turquoise/20 text-turquoise',
  failed: 'bg-error0/20 text-error0'
}

/** Extract a readable ticker from an asset key like "ETH.USDC-0xA0b8..." → "USDC" */
const tickerFromAssetKey = (key: string): string => {
  const symbol = key.split('.')[1] ?? key
  return symbol.split('-')[0]
}

export const TradingPanelPriceLevels = ({ levels, onRemove }: Props) => {
  const intl = useIntl()

  if (levels.length === 0) return null

  return (
    <div className="border-t border-white/10 bg-white/[0.02] px-4 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-main text-11 font-semibold text-gray-400">
          {intl.formatMessage({ id: 'pools.chart.tradingPanel.priceLevel.add' })}
        </span>
        <span className="text-10 font-main text-gray-600">{levels.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {levels.map((level) => (
          <div
            key={level.id}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-3 py-2 transition-colors',
              level.status === 'triggered' || level.status === 'executing'
                ? 'bg-yellow-500/5 ring-1 ring-yellow-500/20'
                : 'bg-white/5'
            )}>
            {/* Type badge */}
            <span
              className={clsx(
                'rounded px-1.5 py-0.5 font-main text-[10px] font-bold uppercase',
                level.type === 'buy' ? 'bg-turquoise/20 text-turquoise' : 'bg-error0/20 text-error0'
              )}>
              {level.type}
            </span>

            {/* Order details */}
            <div className="flex flex-col">
              <span className="font-main text-11 text-white">
                {level.amount} {level.amountSymbol}
                {level.targetAssetKey && (
                  <span className="text-gray-500"> &rarr; {tickerFromAssetKey(level.targetAssetKey)}</span>
                )}
              </span>
              <span className="text-10 font-main text-gray-500">@ {level.price.toLocaleString()}</span>
            </div>

            {/* Status badge */}
            <span
              className={clsx(
                'ml-auto rounded-full px-2 py-0.5 font-main text-[10px] font-semibold',
                STATUS_STYLE[level.status]
              )}>
              {intl.formatMessage({ id: STATUS_KEY[level.status] })}
            </span>

            {/* Tx hash */}
            {level.txHash && (
              <span className="text-10 font-main font-medium text-turquoise">{level.txHash.slice(0, 6)}...</span>
            )}

            {/* Remove */}
            {(level.status === 'pending' || level.status === 'triggered') && (
              <button
                onClick={() => onRemove(level.id)}
                className="rounded p-0.5 text-gray-600 transition-colors hover:bg-white/10 hover:text-white"
                title={intl.formatMessage({ id: 'pools.chart.tradingPanel.priceLevel.remove' })}>
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
