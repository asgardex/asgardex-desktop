import { useMemo } from 'react'

import { BoltIcon } from '@heroicons/react/24/outline'
import { QuoteSwap } from '@xchainjs/xchain-aggregator'
import clsx from 'clsx'
import { option as O } from 'fp-ts'

import Amount from '../../assets/svg/amount.svg?react'
import StopWatch from '../../assets/svg/stopwatch.svg?react'
import { protocolMapping } from '../../helpers/protocolHelper'
import { Collapse } from '../uielements/collapse'
import { ProviderIcon } from './ProviderIcon'

// Extended QuoteSwap type to include boost information
type ExtendedQuoteSwap = QuoteSwap & {
  isBoostQuote?: boolean
}

type Props = {
  targetAsset: string
  quote: O.Option<ExtendedQuoteSwap>
  quotes: O.Option<ExtendedQuoteSwap[]>
  onSelectQuote: (selectedQuote: ExtendedQuoteSwap) => void // Callback for quote selection
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${secs}s`
}

const Route = ({
  className,
  quote,
  targetAsset,
  isBestRate,
  isFastest
}: {
  className?: string
  quote: ExtendedQuoteSwap
  targetAsset: string
  isBestRate: boolean
  isFastest: boolean
}) => {
  const isBoost = (quote as ExtendedQuoteSwap).isBoostQuote

  return (
    <div
      className={clsx(
        'flex flex-col',
        isBoost && 'border-l-4 border-yellow-400 pl-2', // Add boost visual indicator
        className
      )}>
      <div className="flex w-full items-center space-x-2">
        <ProviderIcon protocol={quote.protocol} />
        {isBoost && <BoltIcon className="h-4 w-4 text-yellow-400" />}
        <span className="m-0 font-main text-[14px] text-text0 dark:text-gray2d">
          {isBoost ? 'Boost ' : 'Regular '}
          {protocolMapping?.[quote.protocol as keyof typeof protocolMapping] ?? quote.protocol}
        </span>
        {isBoost && <span className="rounded bg-yellow-400 px-1 text-11 text-black">FASTER</span>}
        {isBestRate && !isBoost && (
          <span className="rounded bg-warning0 px-1 text-11 dark:bg-warning0d">BEST RATE</span>
        )}
        {isFastest && !isBoost && <span className="rounded bg-turquoise px-1 text-11">FASTEST</span>}
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
          <div className="text-red-600 dark:text-red-400 mt-1 text-[11px]">
            {quote.errors.map((error, index) => (
              <span key={index}>
                {error.includes('price limit')
                  ? 'Price slippage too high. Please adjust your price tolerance settings.'
                  : error}
                {index < quote.errors.length - 1 && ' | '}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const SwapRoute = ({ targetAsset, quote, quotes, onSelectQuote }: Props) => {
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
    const validQuotes = quotes.value.filter((q) => q.canSwap)

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
              targetAsset={targetAsset}
              isBestRate={bestQuote ? activeQuote.expectedAmount.eq(bestQuote.expectedAmount) : false}
              isFastest={fastestQuote ? activeQuote.totalSwapSeconds === fastestQuote.totalSwapSeconds : false}
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
                  (availableQuote as ExtendedQuoteSwap).isBoostQuote
                    ? 'border-yellow-400 bg-yellow-50 dark:border-yellow-400 dark:bg-yellow-900/20'
                    : 'border-gray1 dark:border-gray0d'
                )}
                onClick={() => onSelectQuote(availableQuote)}>
                <Route
                  quote={availableQuote}
                  targetAsset={targetAsset}
                  isBestRate={bestQuote ? availableQuote.expectedAmount.eq(bestQuote.expectedAmount) : false}
                  isFastest={fastestQuote ? availableQuote.totalSwapSeconds === fastestQuote.totalSwapSeconds : false}
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
