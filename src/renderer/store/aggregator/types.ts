import { Aggregator, QuoteSwap } from '@xchainjs/xchain-aggregator'

export type State = {
  isLoading: boolean
  aggregator: Aggregator
  quoteSwap: QuoteSwap | null
}
