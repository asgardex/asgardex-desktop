import { Aggregator, QuoteSwap } from '@xchainjs/xchain-aggregator'
import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'

export type State = {
  isLoading: boolean
  aggregator: Aggregator
  quoteSwap: QuoteSwap[] | null
  protocols: Protocol[]
}
