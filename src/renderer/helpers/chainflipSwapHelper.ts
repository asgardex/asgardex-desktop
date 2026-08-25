import { ChainflipDepositChannel, QuoteSwapParams } from '@xchainjs/xchain-aggregator'
import { AnyAsset } from '@xchainjs/xchain-util'

import { SendTxParams } from '../services/chain/types'

/**
 * Reject channels that expire sooner than this — Ledger/EVM inclusion needs headroom.
 * Aggregator 3.0+: channels are opened at confirm, not at quote time.
 */
export const MIN_CHAINFLIP_CHANNEL_TTL_MS = 90_000

/**
 * Chainflip asset ids are uppercase in the broker / SDK quote path.
 */
export const toChainflipQuoteAsset = <T extends AnyAsset>(asset: T): T =>
  ({
    ...asset,
    symbol: asset.symbol.toUpperCase()
  }) as T

/**
 * Prefer the live channel opened at submit (`requestChainflipDepositAddress`) over any
 * legacy/empty `depositChannelId` that may still appear on an estimate quote.
 */
export const resolveChainflipChannelId = (
  liveChannelId?: string | null,
  quoteChannelId?: string | null
): string | undefined => liveChannelId || quoteChannelId || undefined

/**
 * Ensure a freshly opened deposit channel still has enough TTL to broadcast + get observed.
 * @throws Error when remaining TTL is below `minTtlMs`
 */
export const assertSufficientChainflipChannelTtl = (
  expiresAt: Date,
  nowMs: number = Date.now(),
  minTtlMs: number = MIN_CHAINFLIP_CHANNEL_TTL_MS
): void => {
  const ttlMs = expiresAt.getTime() - nowMs
  if (ttlMs < minTtlMs) {
    throw new Error(
      `Chainflip deposit channel expires in ${Math.max(0, Math.floor(ttlMs / 1000))}s — too soon to broadcast safely. Retry.`
    )
  }
}

/**
 * Fill the deposit recipient from a live channel. Quotes are address-less after aggregator 3.0.
 */
export const buildChainflipBroadcastParams = (
  params: SendTxParams,
  channel: Pick<ChainflipDepositChannel, 'depositAddress'>
): SendTxParams => ({
  ...params,
  recipient: channel.depositAddress,
  memo: ''
})

export type OpenChainflipChannelForSubmitArgs = {
  requestChainflipDepositAddress: (params: QuoteSwapParams) => Promise<ChainflipDepositChannel>
  quoteParams: QuoteSwapParams
  nowMs?: number
  minTtlMs?: number
}

/**
 * Open a live Chainflip deposit channel immediately before broadcast and reject short TTLs.
 * Does not broadcast — callers pass the result into `buildChainflipBroadcastParams` + `swapCF$`.
 */
export const openChainflipChannelForSubmit = async ({
  requestChainflipDepositAddress,
  quoteParams,
  nowMs = Date.now(),
  minTtlMs = MIN_CHAINFLIP_CHANNEL_TTL_MS
}: OpenChainflipChannelForSubmitArgs): Promise<ChainflipDepositChannel> => {
  const channel = await requestChainflipDepositAddress(quoteParams)
  assertSufficientChainflipChannelTtl(channel.expiresAt, nowMs, minTtlMs)
  return channel
}
