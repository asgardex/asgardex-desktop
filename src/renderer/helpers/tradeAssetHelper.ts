import { AnyAsset, AssetType, Chain } from '@xchainjs/xchain-util'

import { isChainOfMaya, isChainOfThor } from '../../shared/utils/chain'
import { AssetCacao, AssetRuneNative, MAYAChain, THORChain } from '../../shared/utils/chainIds'
import { isBtcAsset, isCacaoAsset, isRuneNativeAsset, isUSDAsset } from './assetHelper'
import { eqAsset } from './fp/eq'

/** Chart and pool history use the L1 pool asset. A trade route (`ETH~ETH`) charts `ETH.ETH`. */
export const toPoolAsset = (asset: AnyAsset): AnyAsset => {
  if (asset.type !== AssetType.TRADE) return asset
  if (isCacaoAsset(asset)) return AssetCacao
  if (asset.chain === AssetRuneNative.chain && asset.symbol.toUpperCase() === AssetRuneNative.symbol) {
    return AssetRuneNative
  }
  const type = asset.symbol.includes('-') ? AssetType.TOKEN : AssetType.NATIVE
  return { ...asset, type }
}

/**
 * Trade settlement keeps RUNE native on THORChain and CACAO native on MAYAChain.
 * Every other pool asset becomes a trade asset (`chain~symbol`).
 */
export const toTradeAsset = (asset: AnyAsset, protocol: Chain): AnyAsset => {
  if (protocol === MAYAChain && isCacaoAsset(asset)) return AssetCacao
  if (protocol === THORChain && isRuneNativeAsset(asset)) return AssetRuneNative
  if (asset.type === AssetType.TRADE) return asset
  return { ...asset, type: AssetType.TRADE }
}

/** Chain whose address signs the swap. Trade assets settle on the dex, not the L1. */
export const settlementChainAsset = (asset: AnyAsset, protocol: Chain): AnyAsset => {
  if (asset.type === AssetType.SYNTH) return AssetCacao
  if (asset.type === AssetType.SECURED) return AssetRuneNative
  if (asset.type === AssetType.TRADE) return protocol === MAYAChain ? AssetCacao : AssetRuneNative
  return asset
}

export const supportsTradeSettlement = (asset: AnyAsset, protocol: Chain): boolean => {
  const chain = toPoolAsset(asset).chain
  return protocol === MAYAChain ? isChainOfMaya(chain) : isChainOfThor(chain)
}

/** Stablecoins first, then the rest, both alphabetical. `exclude` is the asset being traded. */
export const orderSwapAssets = (assets: AnyAsset[], exclude: AnyAsset): AnyAsset[] => {
  const filtered = assets.filter((asset) => !eqAsset.equals(asset, exclude))
  const stablecoins = filtered.filter(isUSDAsset).sort((a, b) => a.ticker.localeCompare(b.ticker))
  const others = filtered.filter((asset) => !isUSDAsset(asset)).sort((a, b) => a.ticker.localeCompare(b.ticker))
  return [...stablecoins, ...others]
}

export const sameMarketAsset = (a: AnyAsset, b: AnyAsset): boolean =>
  a.chain === b.chain && a.symbol.toUpperCase() === b.symbol.toUpperCase()

/** Counter the ticket opens on. USDC first (ETH when several exist), then BTC. */
export const preferredCounter = (assets: AnyAsset[]): AnyAsset | null => {
  const usdc = assets.filter((asset) => asset.ticker.toUpperCase() === 'USDC')
  return usdc.find((asset) => asset.chain === 'ETH') ?? usdc[0] ?? assets.find(isBtcAsset) ?? assets[0] ?? null
}
