import { Asset, Chain, TokenAsset } from '@xchainjs/xchain-util'

export type ChainflipAssetRowData = {
  asset: Asset | TokenAsset
  chain: Chain
  name: string
  symbol: string
  decimals: number
  minSwapAmount: string
  priceUSD: number | undefined
  boostAvailable: boolean
}
