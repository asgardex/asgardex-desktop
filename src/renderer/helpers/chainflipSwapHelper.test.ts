import { ChainflipDepositChannel, QuoteSwapParams } from '@xchainjs/xchain-aggregator'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { baseAmount, CryptoAmount } from '@xchainjs/xchain-util'
import { describe, expect, it, vi } from 'vitest'

import { WalletType } from '../../shared/wallet/types'
import { SendTxParams } from '../services/chain/types'
import {
  assertSufficientChainflipChannelTtl,
  buildChainflipBroadcastParams,
  MIN_CHAINFLIP_CHANNEL_TTL_MS,
  openChainflipChannelForSubmit,
  resolveChainflipChannelId,
  toChainflipQuoteAsset
} from './chainflipSwapHelper'

const makeChannel = (overrides: Partial<ChainflipDepositChannel> = {}): ChainflipDepositChannel => ({
  depositAddress: '0xdeposit',
  depositChannelId: 'ethereum-123-456',
  expiresAt: new Date(Date.now() + 5 * 60_000),
  expectedAmount: new CryptoAmount(baseAmount(1), AssetETH),
  slipBasisPoints: 50,
  ...overrides
})

const makeSendParams = (overrides: Partial<SendTxParams> = {}): SendTxParams => ({
  walletType: WalletType.Keystore,
  asset: AssetETH,
  sender: '0xsender',
  recipient: '', // aggregator 3.0 quotes leave this empty until channel open
  amount: baseAmount(1_000_000),
  memo: 'stale-quote-memo',
  walletAccount: 0,
  walletIndex: 0,
  hdMode: 'default',
  ...overrides
})

describe('helpers/chainflipSwapHelper', () => {
  describe('toChainflipQuoteAsset', () => {
    it('uppercases the asset symbol for the broker quote path', () => {
      const lower = { ...AssetETH, symbol: 'eth' }
      expect(toChainflipQuoteAsset(lower)).toEqual({ ...AssetETH, symbol: 'ETH' })
    })
  })

  describe('resolveChainflipChannelId', () => {
    it('prefers the live channel id opened at submit over the quote id', () => {
      expect(resolveChainflipChannelId('live-channel', 'quote-channel')).toBe('live-channel')
    })

    it('falls back to the quote channel id when no live channel exists', () => {
      expect(resolveChainflipChannelId(undefined, 'quote-channel')).toBe('quote-channel')
      expect(resolveChainflipChannelId(null, 'quote-channel')).toBe('quote-channel')
    })

    it('returns undefined when neither source has an id', () => {
      expect(resolveChainflipChannelId(undefined, undefined)).toBeUndefined()
      expect(resolveChainflipChannelId(null, '')).toBeUndefined()
    })
  })

  describe('assertSufficientChainflipChannelTtl', () => {
    const now = 1_700_000_000_000

    it('allows channels with enough remaining TTL', () => {
      expect(() => assertSufficientChainflipChannelTtl(new Date(now + MIN_CHAINFLIP_CHANNEL_TTL_MS), now)).not.toThrow()
      expect(() =>
        assertSufficientChainflipChannelTtl(new Date(now + MIN_CHAINFLIP_CHANNEL_TTL_MS + 1), now)
      ).not.toThrow()
    })

    it('rejects channels that expire sooner than the minimum TTL', () => {
      expect(() => assertSufficientChainflipChannelTtl(new Date(now + MIN_CHAINFLIP_CHANNEL_TTL_MS - 1), now)).toThrow(
        /expires in 89s/
      )
    })

    it('rejects already-expired channels', () => {
      expect(() => assertSufficientChainflipChannelTtl(new Date(now - 1_000), now)).toThrow(/expires in 0s/)
    })
  })

  describe('buildChainflipBroadcastParams', () => {
    it('replaces empty quote recipient with the live deposit address and clears memo', () => {
      const params = makeSendParams()
      const channel = makeChannel({ depositAddress: '0xcf-deposit' })

      expect(buildChainflipBroadcastParams(params, channel)).toEqual({
        ...params,
        recipient: '0xcf-deposit',
        memo: ''
      })
    })
  })

  describe('openChainflipChannelForSubmit', () => {
    const quoteParams: QuoteSwapParams = {
      fromAsset: AssetETH,
      destinationAsset: AssetBTC,
      amount: new CryptoAmount(baseAmount(1_000_000), AssetETH),
      fromAddress: '0xsender',
      destinationAddress: 'bc1qdest',
      enableBoost: true
    }

    it('opens a channel with the quote params and returns it when TTL is sufficient', async () => {
      const now = 1_700_000_000_000
      const channel = makeChannel({
        depositChannelId: 'opened-1',
        expiresAt: new Date(now + 3 * 60_000)
      })
      const requestChainflipDepositAddress = vi.fn().mockResolvedValue(channel)

      const result = await openChainflipChannelForSubmit({
        requestChainflipDepositAddress,
        quoteParams,
        nowMs: now
      })

      expect(requestChainflipDepositAddress).toHaveBeenCalledTimes(1)
      expect(requestChainflipDepositAddress).toHaveBeenCalledWith(quoteParams)
      expect(result).toBe(channel)
    })

    it('does not return a short-TTL channel (caller must not broadcast)', async () => {
      const now = 1_700_000_000_000
      const requestChainflipDepositAddress = vi.fn().mockResolvedValue(
        makeChannel({
          depositChannelId: 'too-short',
          expiresAt: new Date(now + 30_000)
        })
      )

      await expect(
        openChainflipChannelForSubmit({
          requestChainflipDepositAddress,
          quoteParams,
          nowMs: now
        })
      ).rejects.toThrow(/too soon to broadcast safely/)

      expect(requestChainflipDepositAddress).toHaveBeenCalledTimes(1)
    })

    it('propagates requestChainflipDepositAddress failures (e.g. Chainflip offline)', async () => {
      const requestChainflipDepositAddress = vi.fn().mockRejectedValue(new Error('Chainflip RPC unavailable'))

      await expect(
        openChainflipChannelForSubmit({
          requestChainflipDepositAddress,
          quoteParams
        })
      ).rejects.toThrow(/Chainflip RPC unavailable/)
    })

    it('forwards enableBoost on the quote params used to open the channel', async () => {
      const requestChainflipDepositAddress = vi.fn().mockResolvedValue(makeChannel())

      await openChainflipChannelForSubmit({
        requestChainflipDepositAddress,
        quoteParams: { ...quoteParams, enableBoost: false }
      })

      expect(requestChainflipDepositAddress.mock.calls[0][0].enableBoost).toBe(false)
    })
  })
})
