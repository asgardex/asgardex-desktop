import { useMemo } from 'react'

import * as O from 'fp-ts/Option'
import { useIntl } from 'react-intl'

import { ProviderIcon } from './ProviderIcon'
import { QuoteWithProtocol } from './Swap.types'

type Props = {
  isLoading: boolean
  quotes: O.Option<QuoteWithProtocol[]>
}

const protocolMapping = {
  Thorchain: 'THORChain',
  Mayachain: 'MAYAChain',
  Chainflip: 'Chainflip'
}

export const SwapRoute = ({ isLoading, quotes }: Props) => {
  const intl = useIntl()

  const { bestQuote, fastestQuote } = useMemo(() => {
    if (O.isNone(quotes)) {
      return { bestQuote: null, fastestQuote: null }
    }

    const sortedByAmount = [...quotes.value].sort((a, b) => {
      const amountA = parseFloat(a.estimate.expectedAmount.assetAmount.amount().toString())
      const amountB = parseFloat(b.estimate.expectedAmount.assetAmount.amount().toString())
      return amountA - amountB // Sort by highest amount
    })

    const sortedByTime = [...quotes.value].sort((a, b) => {
      const timeA = a.estimate.totalSwapSeconds
      const timeB = b.estimate.totalSwapSeconds
      return timeA - timeB // Sort by lowest time
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
    <div className="flex flex-col space-y-2">
      {bestSwapProtocol && (
        <div className="flex items-center space-x-2 rounded-lg border border-solid border-gray1 py-2 px-4 dark:border-gray0d">
          {intl.formatMessage({ id: 'swap.aggregator.bestRoute' })}
          <ProviderIcon protocol={bestSwapProtocol} />
          <span className="m-0 font-main text-[14px] text-gray2 dark:text-gray2d">
            {protocolMapping?.[bestSwapProtocol as keyof typeof protocolMapping] ?? bestSwapProtocol}
          </span>
        </div>
      )}
      {fastestSwapProtocol && (
        <div className="flex items-center space-x-2 rounded-lg border border-solid border-gray1 py-2 px-4 dark:border-gray0d">
          {intl.formatMessage({ id: 'swap.aggregator.fastestRoute' })}
          <ProviderIcon protocol={fastestSwapProtocol} />
          <span className="m-0 font-main text-[14px] text-gray2 dark:text-gray2d">
            {protocolMapping?.[fastestSwapProtocol as keyof typeof protocolMapping] ?? fastestSwapProtocol}
          </span>
        </div>
      )}
    </div>
  )
}
