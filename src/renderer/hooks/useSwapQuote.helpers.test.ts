import { AssetETH } from '@xchainjs/xchain-ethereum'
import { baseAmount, CryptoAmount } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import type { ExtendedQuoteSwap } from '../components/swap/Swap.types'
import { pickSelectedQuote, sortQuotesByOutput } from './useSwapQuote.helpers'

const makeQuote = (protocol: ExtendedQuoteSwap['protocol'], outAmount: number): ExtendedQuoteSwap =>
  ({
    protocol,
    canSwap: true,
    expectedAmount: new CryptoAmount(baseAmount(outAmount), AssetETH),
    totalSwapSeconds: 60,
    errors: [],
    slipBasisPoints: 10,
    toAddress: 'addr',
    memo: '',
    fees: {
      outboundFee: new CryptoAmount(baseAmount(1), AssetETH),
      affiliateFee: new CryptoAmount(baseAmount(0), AssetETH),
      liquidityFee: new CryptoAmount(baseAmount(0), AssetETH)
    }
  }) as unknown as ExtendedQuoteSwap

describe('useSwapQuote.helpers', () => {
  describe('sortQuotesByOutput', () => {
    it('orders higher expected output first', () => {
      const a = makeQuote('Chainflip', 100)
      const b = makeQuote('OneClick', 150)
      expect(sortQuotesByOutput([a, b]).map((q) => q.protocol)).toEqual(['OneClick', 'Chainflip'])
    })
  })

  describe('pickSelectedQuote', () => {
    const chainflip = makeQuote('Chainflip', 100)
    const oneClick = makeQuote('OneClick', 150)
    const thor = makeQuote('Thorchain', 90)

    it('keeps the preferred protocol even when another quote pays more', () => {
      const sorted = sortQuotesByOutput([chainflip, oneClick, thor])
      expect(pickSelectedQuote(sorted, [], 'Chainflip')?.protocol).toBe('Chainflip')
    })

    it('falls back to best output when preferred protocol is missing', () => {
      const sorted = sortQuotesByOutput([oneClick, thor])
      expect(pickSelectedQuote(sorted, [], 'Chainflip')?.protocol).toBe('OneClick')
    })

    it('picks best output when there is no preference', () => {
      const sorted = sortQuotesByOutput([chainflip, oneClick])
      expect(pickSelectedQuote(sorted, [], null)?.protocol).toBe('OneClick')
    })

    it('can keep preferred from approval-blocked quotes', () => {
      const blocked = [{ ...thor, canSwap: false }] as unknown as ExtendedQuoteSwap[]
      expect(pickSelectedQuote([], blocked, 'Thorchain')?.protocol).toBe('Thorchain')
    })
  })
})
