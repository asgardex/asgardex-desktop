import { useMemo } from 'react'

import * as O from 'fp-ts/Option'
import { useIntl } from 'react-intl'

import { ProviderIcon } from './ProviderIcon'
import { QuoteWithProtocol } from './Swap.types'

type Props = {
  isLoading: boolean
  quotes: O.Option<QuoteWithProtocol[]>
  onSelectQuote: (selectedQuote: QuoteWithProtocol) => void // Callback for quote selection
}

const protocolMapping = {
  Thorchain: 'THORChain',
  Mayachain: 'MAYAChain',
  Chainflip: 'Chainflip'
}

export const SwapRoute = ({ isLoading, quotes, onSelectQuote }: Props) => {
  const intl = useIntl()

  const { bestQuote, fastestQuote } = useMemo(() => {
    if (O.isNone(quotes)) {
      return { bestQuote: null, fastestQuote: null }
    }

    const sortedByAmount = [...quotes.value].sort((a, b) => {
      const amountA = parseFloat(a.estimate.expectedAmount.assetAmount.amount().toString())
      const amountB = parseFloat(b.estimate.expectedAmount.assetAmount.amount().toString())
      return amountB - amountA // Sort by highest amount (descending order)
    })

    const sortedByTime = [...quotes.value].sort((a, b) => {
      const timeA = a.estimate.totalSwapSeconds
      const timeB = b.estimate.totalSwapSeconds
      return timeA - timeB // Sort by lowest time (ascending order)
    })

    return {
      bestQuote: sortedByAmount[0], // Best route is the first item after sorting by amount
      fastestQuote: sortedByTime[0] // Fastest route is the first item after sorting by time
    }
  }, [quotes])

  const bestSwapProtocol = useMemo(() => {
    return bestQuote ? bestQuote.protocol : isLoading ? intl.formatMessage({ id: 'common.loading' }) : ''
  }, [bestQuote, isLoading, intl])

  const fastestSwapProtocol = useMemo(() => {
    return fastestQuote ? fastestQuote.protocol : isLoading ? intl.formatMessage({ id: 'common.loading' }) : ''
  }, [fastestQuote, isLoading, intl])

  return (
    <div className="flex space-x-2 rounded-lg border border-solid border-gray1 p-2 dark:border-gray0d">
      {bestSwapProtocol && bestQuote && (
        <div className="flex flex-1 cursor-pointer items-center justify-between rounded-md border border-solid border-gray1 p-2 hover:bg-gray1 dark:border-gray0d hover:dark:bg-gray0d">
          <div className="flex flex-col items-center space-y-2">
            <span className="text-gray text-[14px] dark:text-gray2d">
              {intl.formatMessage({ id: 'swap.aggregator.bestRoute' })}
            </span>
            <div className="flex items-center space-x-2">
              <ProviderIcon protocol={bestSwapProtocol} />
              <span className="m-0 font-main text-[14px] text-gray2 dark:text-gray2d">
                {protocolMapping?.[bestSwapProtocol as keyof typeof protocolMapping] ?? bestSwapProtocol}
              </span>
            </div>
          </div>
          <button
            onClick={() => onSelectQuote(bestQuote)} // Trigger callback on click
            className="flex items-center justify-center rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-500"
              viewBox="0 0 20 20"
              fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}
      {fastestSwapProtocol && fastestQuote && (
        <div className="flex flex-1 cursor-pointer items-center justify-between rounded-md border border-solid border-gray1 p-2 hover:bg-gray1 dark:border-gray0d hover:dark:bg-gray0d">
          <div className="flex flex-col items-center space-y-2">
            <span className="text-gray text-[14px] dark:text-gray2d">
              {intl.formatMessage({ id: 'swap.aggregator.fastestRoute' })}
            </span>
            <div className="flex items-center space-x-2">
              <ProviderIcon protocol={fastestSwapProtocol} />
              <span className="m-0 font-main text-[14px] text-gray2 dark:text-gray2d">
                {protocolMapping?.[fastestSwapProtocol as keyof typeof protocolMapping] ?? fastestSwapProtocol}
              </span>
            </div>
          </div>
          <button
            onClick={() => onSelectQuote(fastestQuote)} // Trigger callback on click
            className="flex items-center justify-center rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-500"
              viewBox="0 0 20 20"
              fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
