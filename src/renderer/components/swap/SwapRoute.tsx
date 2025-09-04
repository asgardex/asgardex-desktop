import { useMemo } from 'react'

import { QuoteSwap, QuoteSwap as QuoteSwapProtocol } from '@xchainjs/xchain-aggregator'
import clsx from 'clsx'
import { option as O } from 'fp-ts'

import Amount from '../../assets/svg/amount.svg?react'
import StopWatch from '../../assets/svg/stopwatch.svg?react'
import { protocolMapping } from '../../helpers/protocolHelper'
import { Collapse } from '../uielements/collapse'
import { ProviderIcon } from './ProviderIcon'

type Props = {
  targetAsset: string
  quote: O.Option<QuoteSwap>
  quotes: O.Option<QuoteSwap[]>
  onSelectQuote: (selectedQuote: QuoteSwap) => void // Callback for quote selection
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
  quote: QuoteSwapProtocol
  targetAsset: string
  isBestRate: boolean
  isFastest: boolean
}) => {
  return (
    <div className={clsx('flex flex-col', className)}>
      <div className="flex w-full items-center space-x-2">
        <ProviderIcon protocol={quote.protocol} />
        <span className="m-0 font-main text-[14px] text-text0 dark:text-gray2d">
          {protocolMapping?.[quote.protocol as keyof typeof protocolMapping] ?? quote.protocol}
        </span>
        {isBestRate && <span className="rounded bg-warning0 px-1 text-11 dark:bg-warning0d">BEST RATE</span>}
        {isFastest && <span className="rounded bg-turquoise px-1 text-11">FASTEST</span>}
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
              Est. Streaming Time: <b>{formatTime(quote.totalSwapSeconds)}</b>
            </span>
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

    const sortedByAmount = [...quotes.value].sort((a, b) => {
      const amountA = parseFloat(a.expectedAmount.assetAmount.amount().toString())
      const amountB = parseFloat(b.expectedAmount.assetAmount.amount().toString())
      return amountB - amountA
    })

    const sortedByTime = [...quotes.value].sort((a, b) => {
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
            .filter((route) => route.protocol !== activeQuote.protocol)
            .map((availableQuote, index) => (
              <div
                key={`route-${availableQuote.protocol}-${index}`}
                className="mx-2 mb-2 cursor-pointer rounded-lg border border-solid border-gray1 p-2 dark:border-gray0d"
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
