import { AssetETH } from '@xchainjs/xchain-ethereum'
import type { TxDetails } from '@xchainjs/xchain-thorchain-query'
import { baseAmount, CryptoAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { describe, expect, it } from 'vitest'

import { THORChain } from '../../shared/utils/chainIds'
import type { PoolAddress } from '../services/midgard/midgardTypes'
import { poolAddressForQuote, shortQuoteError, thorTradeQuoteToAggregator } from './tradeQuote'

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
    expect(mapped.router).toBe('')
  })

  it('keeps a router from the thornode quote', () => {
    const output = new CryptoAmount(baseAmount(1, 8), AssetETH)
    const quote: TxDetails = {
      memo: '=:BTC.BTC:bc1q:0',
      toAddress: '0x0d15b57a5ba0a31a4774c03ddfacf79b289db9ce',
      dustThreshold: new CryptoAmount(baseAmount(1, 8), AssetETH),
      expiry: new Date(0),
      txEstimate: {
        netOutput: output,
        netOutputStreaming: output,
        totalFees: {
          asset: AssetETH,
          affiliateFee: output,
          outboundFee: output,
          liquidityFee: output
        },
        maxStreamingQuantity: 0,
        outboundDelaySeconds: 0,
        outboundDelayBlocks: 0,
        slipBasisPoints: 0,
        streamingSlipBasisPoints: 0,
        streamingSwapBlocks: 0,
        streamingSwapSeconds: 0,
        totalSwapSeconds: 0,
        router: '0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4',
        recommendedGasRate: '0',
        canSwap: true,
        errors: [],
        warning: ''
      }
    }

    expect(thorTradeQuoteToAggregator(quote).router).toBe('0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4')
  })
})

describe('poolAddressForQuote', () => {
  const cached: PoolAddress = {
    protocol: THORChain,
    chain: 'AVAX',
    address: '0x718f6c9df785bc4e323086de024ca822efbe8ab9',
    router: O.some('0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4'),
    halted: false
  }

  it('keeps the cached vault when the quote has no inbound address', () => {
    const next = poolAddressForQuote(cached, { toAddress: '   ' })
    expect(next).toBe(cached)
  })

  it('pays the quote vault and keeps a router the aggregator quote did not carry', () => {
    const next = poolAddressForQuote(cached, {
      toAddress: '0x0d15b57a5ba0a31a4774c03ddfacf79b289db9ce'
    })
    expect(next.address).toBe('0x0d15b57a5ba0a31a4774c03ddfacf79b289db9ce')
    expect(next.router).toEqual(cached.router)
    expect(next.chain).toBe('AVAX')
  })

  it('uses the quote router when the quote has one', () => {
    const next = poolAddressForQuote(cached, {
      toAddress: '0x0d15b57a5ba0a31a4774c03ddfacf79b289db9ce',
      router: '0xnewrouter'
    })
    expect(next.router).toEqual(O.some('0xnewrouter'))
  })

  it('clears the router when the quote says this chain has none', () => {
    const next = poolAddressForQuote(cached, {
      toAddress: 'bc1qd5gsu875lekewcel0p6wvuev25ynn7ee79g3lf',
      router: ''
    })
    expect(next.address).toBe('bc1qd5gsu875lekewcel0p6wvuev25ynn7ee79g3lf')
    expect(next.router).toEqual(O.none)
  })
})
