import type { QuoteSwap } from '@xchainjs/xchain-aggregator'
import type { Protocol } from '@xchainjs/xchain-aggregator/lib/types'

export type State = {
  isLoading: boolean
  quoteSwap: QuoteSwap[] | null
  protocols: Protocol[]
  isBoostEnabled: boolean
}
