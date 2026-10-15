import { AnyAsset, assetToString, AssetType } from '@xchainjs/xchain-util'

import { eqAsset } from '../../../../helpers/fp/eq'
import { CommonMessageKey } from '../../../../i18n/types'

export enum ExtendedAssetType {
  All = 'all',
  Favorite = 'favorite',
  Native = AssetType.NATIVE,
  Secured = AssetType.SECURED
}

export const filterButtons: { type: ExtendedAssetType; label: CommonMessageKey }[] = [
  { type: ExtendedAssetType.All, label: 'common.all' },
  { type: ExtendedAssetType.Native, label: 'common.asset.native' },
  { type: ExtendedAssetType.Secured, label: 'common.asset.secured' },
  { type: ExtendedAssetType.Favorite, label: 'common.asset.favourites' }
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

export type AssetMenuArrangement =
  { kind: 'flat'; assets: AnyAsset[] } | { kind: 'sections'; favourites: AnyAsset[]; rest: AnyAsset[] }

const isFavouriteAsset = (favourites: AnyAsset[], asset: AnyAsset): boolean =>
  favourites.some((favourite) => eqAsset.equals(favourite, asset))

/**
 * Empty search pins favourites, in the order they were starred, above the rest.
 * A search keeps the usual rank, so typing "eth" still puts native ETH first.
 * The Favourite filter shows only starred assets, still in star order when the search is empty.
 */
export const arrangeAssetsForMenu = (
  assets: AnyAsset[],
  search: string,
  activeFilter: ExtendedAssetType,
  favourites: AnyAsset[]
): AssetMenuArrangement => {
  const typeFilter = activeFilter === ExtendedAssetType.Favorite ? ExtendedAssetType.All : activeFilter
  const pool = assets.filter(
    (asset) =>
      assetMatchesTypeFilter(asset, typeFilter) &&
      (activeFilter !== ExtendedAssetType.Favorite || isFavouriteAsset(favourites, asset))
  )

  const query = search.trim()
  if (query) {
    return { kind: 'flat', assets: filterAndSortAssetsForMenu(pool, query, ExtendedAssetType.All) }
  }

  const favouritesInView = favourites
    .map((favourite) => pool.find((asset) => eqAsset.equals(asset, favourite)))
    .filter((asset): asset is AnyAsset => asset !== undefined)

  if (activeFilter === ExtendedAssetType.Favorite || favouritesInView.length === 0) {
    return {
      kind: 'flat',
      assets: activeFilter === ExtendedAssetType.Favorite ? favouritesInView : pool
    }
  }

  return {
    kind: 'sections',
    favourites: favouritesInView,
    rest: pool.filter((asset) => !isFavouriteAsset(favouritesInView, asset))
  }
}
