import type { QuoteSwap as AggregatorQuoteSwap } from '@xchainjs/xchain-aggregator'
import type { QuoteSwap as DexQuoteSwap } from '@xchainjs/xchain-mayachain-query'
import type { TxDetails } from '@xchainjs/xchain-thorchain-query'

/**
 * MAYAChain's aggregator client reports every trade asset as unsupported.
 * The mayanode quote is the same shape the aggregator would return, plus the protocol tag
 * execution already switches on.
 */
export const dexTradeQuoteToAggregator = (quote: DexQuoteSwap): AggregatorQuoteSwap => ({
  protocol: 'Mayachain',
  toAddress: quote.toAddress,
  memo: quote.memo,
  expectedAmount: quote.expectedAmount,
  dustThreshold: quote.dustThreshold,
  fees: {
    asset: quote.fees.asset,
    affiliateFee: quote.fees.affiliateFee,
    outboundFee: quote.fees.outboundFee
  },
  totalSwapSeconds: quote.totalSwapSeconds,
  slipBasisPoints: quote.slipBasisPoints,
  maxStreamingQuantity: quote.maxStreamingQuantity,
  canSwap: quote.canSwap,
  errors: quote.errors,
  warning: quote.warning
})

/**
 * THORChain trade quotes come from thornode, the same call TradeSwap makes.
 * The aggregator path runs an ERC-20 router check on `ETH~USDC` and throws
 * "Can not estimate swap" before a quote exists.
 */
/**
 * The ticket shows one short line. Contract addresses (`USDC-0xA0b8…`) stay out of it.
 */
export const shortQuoteError = (message: string): string => {
  const stripped = message
    .replace(/-0x[a-fA-F0-9]{6,}/gi, '')
    .replace(/0x[a-fA-F0-9]{6,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (stripped.length <= 180) return stripped
  return `${stripped.slice(0, 177)}...`
}

export const thorTradeQuoteToAggregator = (quote: TxDetails): AggregatorQuoteSwap => ({
  protocol: 'Thorchain',
  toAddress: quote.toAddress,
  memo: quote.memo,
  expectedAmount: quote.txEstimate.netOutput,
  dustThreshold: quote.dustThreshold,
  fees: {
    asset: quote.txEstimate.totalFees.asset,
    affiliateFee: quote.txEstimate.totalFees.affiliateFee,
    outboundFee: quote.txEstimate.totalFees.outboundFee
  },
  totalSwapSeconds: quote.txEstimate.totalSwapSeconds,
  slipBasisPoints: quote.txEstimate.slipBasisPoints,
  maxStreamingQuantity: quote.txEstimate.maxStreamingQuantity,
  canSwap: quote.txEstimate.canSwap,
  errors: quote.txEstimate.errors,
  warning: quote.txEstimate.warning
})
