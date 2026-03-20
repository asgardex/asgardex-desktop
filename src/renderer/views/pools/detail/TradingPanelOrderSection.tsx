import * as RD from '@devexperts/remote-data-ts'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { AnyAsset, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { SwapSettings } from '../../../components/swap/components/SwapSettings'
import type { ExtendedQuoteSwap } from '../../../components/swap/Swap.types'
import { Spin } from '../../../components/uielements/spin'
import type { StreamingMode } from '../../../hooks/useStreamingParams'
import { IsApprovedRD } from '../../../services/evm/types'
import type { TradeMode } from './TradingPanelBar'

type Props = {
  visible: boolean
  tradeMode: TradeMode
  targetAsset: AnyAsset | null
  amountStr: string
  // Quote
  selectedQuote: O.Option<ExtendedQuoteSwap>
  quoteError: O.Option<Error>
  isFetching: boolean
  // Streaming
  activeMode: StreamingMode
  streamingInterval: number
  streamingQuantity: number
  onModeChange: (mode: StreamingMode) => void
  onQuantityChange: (value: number) => void
  onResetStreaming: () => void
  // ERC20 approval
  isApprovedState: IsApprovedRD
  needsApproval: boolean
  awaitingConfirmation: boolean
  onApprove: () => void
  // Actions
  onConfirm: () => void
  onClose: () => void
}

export const TradingPanelOrderSection = ({
  visible,
  tradeMode,
  targetAsset,
  amountStr,
  selectedQuote,
  quoteError,
  isFetching,
  activeMode,
  streamingInterval,
  streamingQuantity,
  onModeChange,
  onQuantityChange,
  onResetStreaming,
  isApprovedState,
  needsApproval,
  awaitingConfirmation,
  onApprove,
  onConfirm,
  onClose
}: Props) => {
  const intl = useIntl()

  if (!visible) return null

  const numAmount = parseFloat(amountStr)
  const hasAmount = !!numAmount && numAmount > 0

  const showApproveButton =
    needsApproval && RD.isSuccess(isApprovedState) && isApprovedState.value === false && !awaitingConfirmation

  const canConfirm = FP.pipe(
    selectedQuote,
    O.fold(
      () => false,
      (q) => q.canSwap
    )
  )

  return (
    <div className="border-t border-white/10 bg-white/[0.03] px-4 py-3">
      {/* Header with close */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-12 font-main font-semibold text-gray-300">
          {intl.formatMessage({ id: 'pools.chart.tradingPanel.orderSettings' })}
        </span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Quote content — shown first so user sees the result immediately */}
      {!hasAmount ? (
        <p className="text-12 py-4 text-center font-main text-gray-500">
          {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.noAmount' })}
        </p>
      ) : isFetching ? (
        <div className="flex items-center justify-center py-6">
          <Spin />
        </div>
      ) : O.isSome(quoteError) ? (
        <div className="mb-3 rounded-lg bg-error0/10 px-3 py-2">
          <p className="text-12 font-main text-error0">{quoteError.value.message}</p>
        </div>
      ) : O.isSome(selectedQuote) && targetAsset ? (
        <div className="mb-3">
          <QuoteDetails quote={selectedQuote.value} targetAsset={targetAsset} intl={intl} />
        </div>
      ) : (
        <div className="flex items-center justify-center py-6">
          <Spin />
        </div>
      )}

      {/* Streaming settings — collapsible, below quote */}
      <div className="mb-3">
        <SwapSettings
          activeMode={activeMode}
          streamingInterval={streamingInterval}
          streamingQuantity={streamingQuantity}
          onModeChange={onModeChange}
          onQuantityChange={onQuantityChange}
          onReset={onResetStreaming}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {showApproveButton && (
          <button
            onClick={onApprove}
            className="text-12 flex-1 rounded-lg bg-yellow-500 py-2.5 font-main font-semibold text-white transition-opacity hover:opacity-90">
            {intl.formatMessage({ id: 'pools.chart.tradingPanel.approve' })}
          </button>
        )}
        {awaitingConfirmation && (
          <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-500/20 py-2.5">
            <Spin />
            <span className="text-12 font-main text-yellow-400">
              {intl.formatMessage({ id: 'pools.chart.tradingPanel.approve' })}...
            </span>
          </div>
        )}
        {!showApproveButton && !awaitingConfirmation && (
          <button
            onClick={onConfirm}
            disabled={!hasAmount || isFetching || !canConfirm}
            className={clsx(
              'text-13 flex-1 rounded-lg py-2.5 font-main font-semibold text-white transition-all',
              tradeMode === 'buy'
                ? 'bg-turquoise hover:shadow-[0_0_16px_rgba(80,227,194,0.3)]'
                : 'bg-error0 hover:shadow-[0_0_16px_rgba(255,77,79,0.3)]',
              (!hasAmount || isFetching || !canConfirm) && 'cursor-not-allowed opacity-40 hover:shadow-none'
            )}>
            {intl.formatMessage({
              id: tradeMode === 'buy' ? 'pools.chart.tradingPanel.confirmBuy' : 'pools.chart.tradingPanel.confirmSell'
            })}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Quote details sub-component ──────────────────────────────────────

const QuoteDetails = ({
  quote,
  targetAsset,
  intl
}: {
  quote: ExtendedQuoteSwap
  targetAsset: AnyAsset
  intl: ReturnType<typeof useIntl>
}) => (
  <div className="flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2.5">
    {/* Expected output — prominent */}
    <div className="flex items-center justify-between">
      <span className="font-main text-11 text-gray-400">
        {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.output' })}
      </span>
      <span className="font-main text-14 font-semibold text-turquoise">
        {formatAssetAmountCurrency({
          amount: baseToAsset(quote.expectedAmount.baseAmount),
          asset: targetAsset,
          trimZeros: true
        })}
      </span>
    </div>

    <div className="my-0.5 border-t border-white/5" />

    {/* Slippage */}
    <div className="flex items-center justify-between">
      <span className="font-main text-11 text-gray-500">
        {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.slippage' })}
      </span>
      <span className={clsx('font-main text-11', quote.slipBasisPoints > 500 ? 'text-error0' : 'text-gray-300')}>
        {(quote.slipBasisPoints / 100).toFixed(2)}%
      </span>
    </div>

    {/* Fees */}
    <div className="flex items-center justify-between">
      <span className="font-main text-11 text-gray-500">
        {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.fees' })}
      </span>
      <span className="font-main text-11 text-gray-300">
        {formatAssetAmountCurrency({
          amount: baseToAsset(quote.fees.affiliateFee.baseAmount),
          asset: quote.fees.asset,
          trimZeros: true
        })}
      </span>
    </div>

    {/* Protocol */}
    <div className="flex items-center justify-between">
      <span className="font-main text-11 text-gray-500">
        {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.protocol' })}
      </span>
      <span className="font-main text-11 text-gray-300">{quote.protocol}</span>
    </div>

    {/* Estimated time */}
    {quote.totalSwapSeconds > 0 && (
      <div className="flex items-center justify-between">
        <span className="font-main text-11 text-gray-500">
          {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.time' })}
        </span>
        <span className="font-main text-11 text-gray-300">
          ~{quote.totalSwapSeconds < 60 ? `${quote.totalSwapSeconds}s` : `${Math.ceil(quote.totalSwapSeconds / 60)}m`}
        </span>
      </div>
    )}
  </div>
)
