import { Asset, Chain, TokenAsset } from '@xchainjs/xchain-util'

export type ChainflipAssetRowData = {
  asset: Asset | TokenAsset
  chain: Chain
  name: string
  symbol: string
  decimals: number
  minSwapAmount: string
  priceUSD: number | undefined
  /** USD swap volume over the last 24h, summed across both sides of a swap. `undefined` if not (yet) known. */
  volume24hUsd: number | undefined
  boostAvailable: boolean
}
