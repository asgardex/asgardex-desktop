import { AnyAsset, assetToString, AssetType } from '@xchainjs/xchain-util'

export enum ExtendedAssetType {
  All = 'all',
  Favorite = 'favorite',
  Native = AssetType.NATIVE,
  Secured = AssetType.SECURED
}

export const filterButtons = [
  {
    text: 'All',
    type: ExtendedAssetType.All
  },
  {
    text: 'Native',
    type: ExtendedAssetType.Native
  },
  {
    text: 'Secured',
    type: ExtendedAssetType.Secured
  }
]

/**
 * Lower rank = better match (earlier in the asset picker list).
 * Typing "eth" should put native ETH.ETH ahead of ETH.USDT / BASE.ETH / etc.
 */
export const getAssetSearchRank = (asset: AnyAsset, search: string): number => {
  const q = search.trim().toLowerCase()
  if (!q) return 0

  const ticker = asset.ticker.toLowerCase()
  const chain = asset.chain.toLowerCase()
  const symbol = asset.symbol.toLowerCase()
  const full = assetToString(asset).toLowerCase()
  const isNative = asset.type === AssetType.NATIVE

  // Native gas on the chain named like the query (ETH.ETH, BTC.BTC, …)
  if (isNative && ticker === q && chain === q) return 0
  // Other native gas with matching ticker (BASE.ETH, ARB.ETH, …)
  if (isNative && ticker === q) return 1
  // Exact ticker match (tokens)
  if (ticker === q) return 2
  if (ticker.startsWith(q) && isNative) return 3
  if (ticker.startsWith(q)) return 4
  // Symbol (e.g. USDT-0x… when searching "usdt")
  if (symbol === q || symbol.startsWith(`${q}-`)) return 5
  if (symbol.startsWith(q)) return 6
  // Chain match — ETH.USDT when searching "eth" (after ticker hits)
  if (chain === q && isNative) return 7
  if (chain === q) return 8
  if (full.includes(q)) return 9
  return 100
}

export const assetMatchesSearch = (asset: AnyAsset, search: string): boolean => {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return assetToString(asset).toLowerCase().includes(q)
}

export const assetMatchesTypeFilter = (asset: AnyAsset, activeFilter: ExtendedAssetType): boolean => {
  if (asset.type === AssetType.SYNTH) return false
  if (activeFilter === ExtendedAssetType.Native && asset.type !== AssetType.NATIVE) return false
  if (activeFilter === ExtendedAssetType.Secured && asset.type !== AssetType.SECURED) return false
  return true
}

/**
 * Filter by type + search, then rank so exact native ticker matches come first.
 * Empty search keeps the incoming order.
 */
export const filterAndSortAssetsForMenu = (
  assets: AnyAsset[],
  search: string,
  activeFilter: ExtendedAssetType
): AnyAsset[] => {
  const filtered = assets.filter(
    (asset) => assetMatchesTypeFilter(asset, activeFilter) && assetMatchesSearch(asset, search)
  )

  const q = search.trim()
  if (!q) return filtered

  return filtered
    .map((asset, index) => ({ asset, index, rank: getAssetSearchRank(asset, q) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ asset }) => asset)
}
