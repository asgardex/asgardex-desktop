import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { Spin } from '../../../components/uielements/spin'
import type { PairSwapRow } from './pairSwaps'
import type { PairSwapPhase } from './usePairSwaps'

type Props = {
  poolTicker: string
  rows: PairSwapRow[]
  phase: PairSwapPhase
}

const statusKey = (status: PairSwapRow['status']) => {
  if (status === 'pending') return 'transaction.status.pending' as const
  if (status === 'failed') return 'pools.chart.tradingPanel.priceLevel.failed' as const
  return 'pools.chart.tradingPanel.priceLevel.completed' as const
}

export const TradingPanelSwaps = ({ poolTicker, rows, phase }: Props) => {
  const intl = useIntl()

  return (
    <div className="flex max-h-64 min-h-0 flex-1 flex-col border-t border-white/10 lg:max-h-none">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="font-main text-11 font-semibold text-gray-400">
          {intl.formatMessage({ id: 'pools.chart.tradingPanel.swaps' })}
        </span>
        {rows.length > 0 && <span className="text-10 font-main text-gray-600">{rows.length}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {phase === 'loading' && rows.length === 0 && (
          <div className="flex justify-center py-3">
            <Spin />
          </div>
        )}
        {phase === 'error' && rows.length === 0 && (
          <p className="m-0 py-2 font-main text-11 text-error0">
            {intl.formatMessage({ id: 'pools.chart.tradingPanel.swaps.error' })}
          </p>
        )}
        {phase === 'ready' && rows.length === 0 && (
          <p className="m-0 py-2 font-main text-11 text-gray-500">
            {intl.formatMessage({ id: 'pools.chart.tradingPanel.swaps.empty' })}
          </p>
        )}
        <div className="flex flex-col">
          {rows.map((row) => {
            const sideLabel = intl.formatMessage({ id: row.side === 'buy' ? 'common.buy' : 'common.sell' })
            const sizeText = row.size ? `${row.size} ${poolTicker}` : poolTicker
            const counterText = row.counter ? `${row.counter} ${row.counterTicker}` : row.counterTicker
            const when = intl.formatDate(row.at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            return (
              <div key={row.id} className="flex items-start gap-2 border-b border-white/5 py-2 last:border-b-0">
                <span
                  className={clsx(
                    'mt-0.5 rounded px-1.5 py-0.5 font-main text-[10px] font-bold uppercase',
                    row.side === 'buy' ? 'bg-turquoise/20 text-turquoise' : 'bg-error0/20 text-error0'
                  )}>
                  {sideLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate font-main text-11 text-white">
                    {sizeText}
                    <span className="text-gray-500"> → {counterText}</span>
                  </p>
                  <p className="m-0 font-main text-[10px] text-gray-500">{when}</p>
                </div>
                <span
                  className={clsx(
                    'font-main text-[10px]',
                    row.status === 'failed' && 'text-error0',
                    row.status === 'pending' && 'text-yellow-400',
                    row.status === 'completed' && 'text-gray-500'
                  )}>
                  {intl.formatMessage({ id: statusKey(row.status) })}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
