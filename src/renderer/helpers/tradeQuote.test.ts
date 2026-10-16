import { AssetETH } from '@xchainjs/xchain-ethereum'
import type { TxDetails } from '@xchainjs/xchain-thorchain-query'
import { baseAmount, CryptoAmount } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { shortQuoteError, thorTradeQuoteToAggregator } from './tradeQuote'

describe('shortQuoteError', () => {
  it('drops the contract address and keeps the asset names', () => {
    expect(
      shortQuoteError('Can not estimate swap from ETH~USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48 to ETH~ETH')
    ).toBe('Can not estimate swap from ETH~USDC to ETH~ETH')
  })

  it('leaves a short message unchanged', () => {
    expect(shortQuoteError('No valid swap routes available')).toBe('No valid swap routes available')
  })
})

describe('thorTradeQuoteToAggregator', () => {
  it('keeps the thornode memo and output on a Thorchain quote', () => {
    const output = new CryptoAmount(baseAmount(100_000_000, 8), AssetETH)
    const quote: TxDetails = {
      memo: '=:ETH~ETH:thor1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq2k4h9s',
      toAddress: 'thor1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq2k4h9s',
      dustThreshold: new CryptoAmount(baseAmount(1, 8), AssetETH),
      expiry: new Date(0),
      txEstimate: {
        netOutput: output,
        netOutputStreaming: output,
        totalFees: {
          asset: AssetETH,
          affiliateFee: new CryptoAmount(baseAmount(0, 8), AssetETH),
          outboundFee: new CryptoAmount(baseAmount(2, 8), AssetETH),
          liquidityFee: new CryptoAmount(baseAmount(0, 8), AssetETH)
        },
        maxStreamingQuantity: 3,
        outboundDelaySeconds: 6,
        outboundDelayBlocks: 1,
        slipBasisPoints: 12,
        streamingSlipBasisPoints: 12,
        streamingSwapBlocks: 0,
        streamingSwapSeconds: 0,
        totalSwapSeconds: 20,
        router: '',
        recommendedGasRate: '0',
        canSwap: true,
        errors: [],
        warning: ''
      }
    }

    const mapped = thorTradeQuoteToAggregator(quote)

    expect(mapped.protocol).toBe('Thorchain')
    expect(mapped.memo).toBe(quote.memo)
    expect(mapped.canSwap).toBe(true)
    expect(mapped.expectedAmount).toBe(output)
    expect(mapped.fees.outboundFee.baseAmount.amount().toNumber()).toBe(2)
    expect(mapped.slipBasisPoints).toBe(12)
  })
})
