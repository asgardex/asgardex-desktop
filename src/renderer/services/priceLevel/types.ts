export type PriceLevelStatus = 'pending' | 'triggered' | 'confirming' | 'executing' | 'completed' | 'failed' | 'paused'

/** `usd` is THORChain pool USD. `pair` is counter units per 1 chart asset. Missing means USD. */
export type PriceLevelUnit = 'usd' | 'pair'

export type PriceLevel = {
  id: string
  price: number
  /** Missing means the original USD trigger. */
  unit?: PriceLevelUnit
  /**
   * L1 pool asset of the counter, in assetToString form.
   * Pair orders compare this pool's USD with the chart asset. USD orders use it to check the quote.
   */
  counterAssetKey?: string
  type: 'buy' | 'sell'
  amount: number
  /** Currency symbol for the amount (e.g. '$', 'BTC') */
  amountSymbol: string
  /** The counterparty asset key (assetToString format), e.g. 'ETH.USDC-0xA0b8...' */
  targetAssetKey: string
  status: PriceLevelStatus
  error?: string
  txHash?: string
}
