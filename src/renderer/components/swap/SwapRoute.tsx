import { useMemo } from 'react'

import { QuoteSwap as QuoteSwapProtocol } from '@xchainjs/xchain-aggregator'
import clsx from 'clsx'
import * as O from 'fp-ts/Option'

import { ReactComponent as Amount } from '../../assets/svg/amount.svg'
import { ReactComponent as StopWatch } from '../../assets/svg/stopwatch.svg'
import { Collapse } from '../uielements/collapse'
import { ProviderIcon } from './ProviderIcon'
import { QuoteWithProtocol } from './Swap.types'

type Props = {
  isLoading: boolean
  targetAsset: string
  quote: O.Option<QuoteSwapProtocol>
  quotes: O.Option<QuoteWithProtocol[]>
  onSelectQuote: (selectedQuote: QuoteWithProtocol) => void // Callback for quote selection
}

const protocolMapping = {
  Thorchain: 'THORChain',
  Mayachain: 'MAYAChain',
  Chainflip: 'Chainflip'
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
        <div className="flex flex-row items-center space-x-1">
          <StopWatch className="text-text0 dark:text-gray2d" />
          <span className="text-[12px] text-text0 dark:text-gray2d">
            Est. Time: <b>{formatTime(quote.totalSwapSeconds)}</b>
          </span>
        </div>
        {/* {percentageDifference !== null && percentageDifference > 0 && (
          <span className="text-[12px] text-green-500">Recommended</span>
        )} */}
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
      const amountA = parseFloat(a.estimate.expectedAmount.assetAmount.amount().toString())
      const amountB = parseFloat(b.estimate.expectedAmount.assetAmount.amount().toString())
      return amountB - amountA
    })

    const sortedByTime = [...quotes.value].sort((a, b) => {
      const timeA = a.estimate.totalSwapSeconds
      const timeB = b.estimate.totalSwapSeconds
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
              isBestRate={bestQuote ? activeQuote.expectedAmount.eq(bestQuote.estimate.expectedAmount) : false}
              isFastest={fastestQuote ? activeQuote.totalSwapSeconds === fastestQuote.estimate.totalSwapSeconds : false}
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
                  quote={availableQuote.estimate}
                  targetAsset={targetAsset}
                  isBestRate={
                    bestQuote ? availableQuote.estimate.expectedAmount.eq(bestQuote.estimate.expectedAmount) : false
                  }
                  isFastest={
                    fastestQuote
                      ? availableQuote.estimate.totalSwapSeconds === fastestQuote.estimate.totalSwapSeconds
                      : false
                  }
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
