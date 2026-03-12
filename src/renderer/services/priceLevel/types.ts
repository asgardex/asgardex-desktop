export type PriceLevelStatus = 'pending' | 'triggered' | 'confirming' | 'executing' | 'completed' | 'failed'

export type PriceLevel = {
  id: string
  price: number
  type: 'buy' | 'sell'
  amount: number
  status: PriceLevelStatus
  error?: string
  txHash?: string
}
