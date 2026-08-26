import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'

import type { ExtendedQuoteSwap } from '../components/swap/Swap.types'

/**
 * Prefer the user's previously selected protocol on refresh; otherwise pick best by
 * expected output (then faster totalSwapSeconds). Avoids flipping Chainflip → OneClick
 * when a background re-quote lands while the password modal is open.
 */
export const pickSelectedQuote = (
  sortedViable: ExtendedQuoteSwap[],
  approvalBlocked: ExtendedQuoteSwap[],
  preferredProtocol: Protocol | null
): ExtendedQuoteSwap | undefined => {
  if (preferredProtocol) {
    const kept =
      sortedViable.find((q) => q.protocol === preferredProtocol) ??
      approvalBlocked.find((q) => q.protocol === preferredProtocol)
    if (kept) return kept
  }
  return sortedViable[0] ?? approvalBlocked[0]
}

export const sortQuotesByOutput = (quotesToSort: ExtendedQuoteSwap[]): ExtendedQuoteSwap[] =>
  [...quotesToSort].sort((a, b) => {
    const amountA = parseFloat(a.expectedAmount.assetAmountFixedString())
    const amountB = parseFloat(b.expectedAmount.assetAmountFixedString())
    const timeA = a.totalSwapSeconds
    const timeB = b.totalSwapSeconds
    return amountA > amountB ? -1 : amountA < amountB ? 1 : timeA - timeB
  })
