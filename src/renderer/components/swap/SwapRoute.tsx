import { useMemo } from 'react'

import { QuoteSwap as QuoteSwapProtocol } from '@xchainjs/xchain-aggregator'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useIntl } from 'react-intl'

import { ProviderIcon } from './ProviderIcon'

type Props = {
  isLoading: boolean
  quote: O.Option<QuoteSwapProtocol>
}

const protocolMapping = {
  Thorchain: 'THORChain',
  Mayachain: 'MAYAChain',
  Chainflip: 'Chainflip'
}

export const SwapRoute = ({ isLoading, quote }: Props) => {
  const intl = useIntl()

  const swapProtocol = useMemo(() => {
    const protocol = FP.pipe(
      quote,
      O.fold(
        () => (isLoading ? intl.formatMessage({ id: 'common.loading' }) : ''),
        (swapQuote) => swapQuote.protocol
      )
    )

    return protocol
  }, [isLoading, quote, intl])

  return swapProtocol ? (
    <div className="flex items-center space-x-2 rounded-lg border border-solid border-gray1 py-2 px-4 dark:border-gray0d">
      <ProviderIcon protocol={swapProtocol} />
      <span className="m-0 font-main text-[14px] text-gray2 dark:text-gray2d">
        {protocolMapping?.[swapProtocol as keyof typeof protocolMapping] ?? swapProtocol}
      </span>
    </div>
  ) : null
}
