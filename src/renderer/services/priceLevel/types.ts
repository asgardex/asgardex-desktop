export type PriceLevelStatus = 'pending' | 'triggered' | 'confirming' | 'executing' | 'completed' | 'failed'

export type PriceLevel = {
  id: string
  price: number
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
