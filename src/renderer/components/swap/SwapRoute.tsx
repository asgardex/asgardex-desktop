import { useMemo } from 'react'

import { QuoteSwap } from '@xchainjs/xchain-aggregator'
import clsx from 'clsx'
import { option as O } from 'fp-ts'

import Amount from '../../assets/svg/amount.svg?react'
import BoostIcon from '../../assets/svg/boost.svg'
import StopWatch from '../../assets/svg/stopwatch.svg?react'
import { protocolMapping } from '../../helpers/protocolHelper'
import { useAggregator } from '../../store/aggregator/hooks'
import { SwitchButton } from '../uielements/button/SwitchButton'
import { Collapse } from '../uielements/collapse'
import { ProviderIcon } from './ProviderIcon'

// Extended QuoteSwap type to include boost information
type ExtendedQuoteSwap = QuoteSwap & {
  isBoostQuote?: boolean
}

type Props = {
  isBoostable: boolean
  targetAsset: string
  quote: O.Option<ExtendedQuoteSwap>
  quotes: O.Option<ExtendedQuoteSwap[]>
  onSelectQuote: (selectedQuote: ExtendedQuoteSwap) => void // Callback for quote selection
  quoteOnly?: boolean // Preview mode flag
}

const getPreviewModeErrors = (errors: string[], quoteOnly: boolean) => {
  if (!quoteOnly) return errors

  const isPreviewFilteredError = (error: string) => {
    const errorLower = error.toLowerCase()
    return (
      errorLower.includes('insufficient') ||
      errorLower.includes('not enough') ||
      errorLower.includes('exceed') ||
      errorLower.includes('balance') ||
      errorLower.includes('funds') ||
      errorLower.includes('fee') ||
      errorLower.includes('outbound') ||
      errorLower.includes('inbound') ||
      errorLower.includes('gas') ||
      errorLower.includes('router has not been approved') ||
      errorLower.includes('memo') ||
      errorLower.includes('parsing') ||
      errorLower.includes('undefined') ||
      errorLower.includes('recipient') ||
      errorLower.includes('address')
    )
  }

  return errors.filter((error) => !isPreviewFilteredError(error))
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${secs}s`
}

const Route = ({
  className,
  isBoostable,
  quote,
  targetAsset,
  isBestRate,
  isFastest,
  isBoostEnabled,
  onToggleBoost,
  quoteOnly
}: {
  className?: string
  isBoostable: boolean
  quote: ExtendedQuoteSwap
  targetAsset: string
  isBestRate: boolean
  isFastest: boolean
  isBoostEnabled?: boolean
  onToggleBoost?: (enabled: boolean) => void
  quoteOnly?: boolean
}) => {
  const isChainflip = quote.protocol === 'Chainflip'

  return (
    <div className={clsx('flex flex-grow flex-col', className)}>
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center space-x-2">
          <ProviderIcon protocol={quote.protocol} />
          <span className="m-0 font-main text-[14px] text-text0 dark:text-gray2d">
            {protocolMapping?.[quote.protocol as keyof typeof protocolMapping] ?? quote.protocol}
          </span>
          {isBestRate && <span className="rounded bg-warning0 px-1 text-11 dark:bg-warning0d">BEST RATE</span>}
          {isFastest && <span className="rounded bg-turquoise px-1 text-11 text-white">FASTEST</span>}
        </div>
        {isBoostable && isChainflip && onToggleBoost && isBoostEnabled !== undefined && (
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <img src={BoostIcon} alt="Boost" className="h-5 w-5" />
              <span className="text-11 text-[#FF33AF]">Boost</span>
            </div>
            <SwitchButton active={isBoostEnabled} onChange={onToggleBoost} />
          </div>
        )}
      </div>

      <div className="mt-2 flex w-full flex-col space-y-1">
        <div className="flex flex-row items-center space-x-1">
          <Amount className="text-text0 dark:text-gray2d" />
          <span className="text-[12px] text-text0 dark:text-gray2d">
            Est. Amount:{' '}
            <b>
              {quote.expectedAmount.assetAmount.amount().toFixed(6)} {targetAsset}
            </b>
          </span>
        </div>
        {quote.totalSwapSeconds > 0 && (
          <div className="flex flex-row items-center space-x-1">
            <StopWatch className="text-text0 dark:text-gray2d" />
            <span className="text-[12px] text-text0 dark:text-gray2d">
              Est. Time: <b>{formatTime(quote.totalSwapSeconds)}</b>
            </span>
          </div>
        )}
        {quote.errors && quote.errors.length > 0 && (
          <div className="mt-1 text-[11px] text-error0">
            {getPreviewModeErrors(quote.errors, quoteOnly ?? false).map((error, index) => (
              <span key={index}>
                {error.includes('price limit')
                  ? 'Price slippage too high. Please adjust your price tolerance settings.'
                  : error}
                {index < getPreviewModeErrors(quote.errors, quoteOnly ?? false).length - 1 && ' | '}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const SwapRoute = ({ isBoostable, targetAsset, quote, quotes, onSelectQuote, quoteOnly }: Props) => {
  const { isBoostEnabled, setBoostEnabled } = useAggregator()

  const availableQuotes = useMemo(() => {
    if (O.isNone(quotes)) return []
    return quotes.value
  }, [quotes])

  const activeQuote = useMemo(() => {
    if (O.isNone(quote)) return null
    return quote.value
  }, [quote])

  const { bestQuote, fastestQuote } = useMemo(() => {
    if (O.isNone(quotes)) {
      return { bestQuote: null, fastestQuote: null, numOfAvailableRoutes: 0 }
    }

    // Only consider quotes that can actually swap for best/fastest calculations
    const validQuotes = quotes.value

    const sortedByAmount = [...validQuotes].sort((a, b) => {
      const amountA = parseFloat(a.expectedAmount.assetAmount.amount().toString())
      const amountB = parseFloat(b.expectedAmount.assetAmount.amount().toString())
      return amountB - amountA
    })

    const sortedByTime = [...validQuotes].sort((a, b) => {
      const timeA = a.totalSwapSeconds
      const timeB = b.totalSwapSeconds
      return timeA - timeB
    })

    return {
      bestQuote: sortedByAmount[0],
      fastestQuote: sortedByTime[0],
      numOfAvailableRoutes: quotes.value.length
    }
  }, [quotes])

  return (
    <div>
      {activeQuote ? (
        <Collapse
          header={
            <Route
              className="mt-2"
              quote={activeQuote}
              isBoostable={isBoostable}
              targetAsset={targetAsset}
              isBestRate={bestQuote ? activeQuote.expectedAmount.eq(bestQuote.expectedAmount) : false}
              isFastest={fastestQuote ? activeQuote.totalSwapSeconds === fastestQuote.totalSwapSeconds : false}
              isBoostEnabled={isBoostEnabled}
              onToggleBoost={setBoostEnabled}
              quoteOnly={quoteOnly}
            />
          }>
          {availableQuotes
            .filter((route) => {
              // Only show boost/regular alternatives for Chainflip
              if (route.protocol === 'Chainflip' && activeQuote.protocol === 'Chainflip') {
                // Show the alternative boost/regular option for Chainflip
                return (route as ExtendedQuoteSwap).isBoostQuote !== (activeQuote as ExtendedQuoteSwap).isBoostQuote
              }
              // For other protocols, only show different protocols
              return route.protocol !== activeQuote.protocol
            })
            .map((availableQuote, index) => (
              <div
                key={`route-${availableQuote.protocol}-${(availableQuote as ExtendedQuoteSwap).isBoostQuote ? 'boost' : 'regular'}-${index}`}
                className={clsx(
                  'mx-2 mb-2 cursor-pointer rounded-lg border border-solid p-2',
                  'border-gray1 dark:border-gray0d'
                )}
                onClick={() => onSelectQuote(availableQuote)}>
                <Route
                  quote={availableQuote}
                  isBoostable={isBoostable}
                  targetAsset={targetAsset}
                  isBestRate={bestQuote ? availableQuote.expectedAmount.eq(bestQuote.expectedAmount) : false}
                  isFastest={fastestQuote ? availableQuote.totalSwapSeconds === fastestQuote.totalSwapSeconds : false}
                  isBoostEnabled={isBoostEnabled}
                  onToggleBoost={setBoostEnabled}
                  quoteOnly={quoteOnly}
                />
              </div>
            ))}
        </Collapse>
      ) : (
        <></>
      )}
    </div>
  )
}
