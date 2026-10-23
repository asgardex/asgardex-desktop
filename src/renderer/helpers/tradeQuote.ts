import type { QuoteSwap as AggregatorQuoteSwap } from '@xchainjs/xchain-aggregator'
import type { QuoteSwap as DexQuoteSwap } from '@xchainjs/xchain-mayachain-query'
import type { TxDetails } from '@xchainjs/xchain-thorchain-query'

import { optionFromNullableString } from '../../shared/utils/fp'
import type { PoolAddress } from '../services/midgard/midgardTypes'

/** Vault and router from a THOR or Maya quote. `router` omitted means the quote did not carry one. */
export type QuoteInbound = {
  toAddress: string
  router?: string
}

/**
 * MAYAChain's aggregator client reports every trade asset as unsupported.
 * The mayanode quote is the same shape the aggregator would return, plus the protocol tag
 * execution already switches on.
 */
export const dexTradeQuoteToAggregator = (quote: DexQuoteSwap): AggregatorQuoteSwap & QuoteInbound => ({
  protocol: 'Mayachain',
  toAddress: quote.toAddress,
  router: quote.router,
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

export const thorTradeQuoteToAggregator = (quote: TxDetails): AggregatorQuoteSwap & QuoteInbound => ({
  protocol: 'Thorchain',
  toAddress: quote.toAddress,
  router: quote.txEstimate.router,
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

/**
 * Pay the quote's inbound vault. The cached pool address still supplies chain, protocol,
 * and halt state. Aggregator quotes omit the router, so an absent router keeps the cached one.
 * An empty router means this chain has none.
 */
export const poolAddressForQuote = (cached: PoolAddress, quote: QuoteInbound): PoolAddress => {
  const inbound = quote.toAddress.trim()
  if (!inbound) return cached
  return {
    ...cached,
    address: inbound,
    router: quote.router === undefined ? cached.router : optionFromNullableString(quote.router)
  }
}
