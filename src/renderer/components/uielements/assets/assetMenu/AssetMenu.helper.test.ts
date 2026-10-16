import { AssetARB, AssetAETH } from '@xchainjs/xchain-arbitrum'
import { AssetAVAX } from '@xchainjs/xchain-avax'
import { AssetBETH } from '@xchainjs/xchain-base'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { assetFromStringEx, AssetType } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import {
  arrangeAssetsForMenu,
  assetMatchesSearch,
  ExtendedAssetType,
  filterAndSortAssetsForMenu,
  getAssetSearchRank,
  showNoFavouritesHint
} from './AssetMenu.helper'

const assetUSDT = assetFromStringEx('ETH.USDT-0xdAC17F958D2ee523a2206206994597C13D831ec7')
const assetUSDC = assetFromStringEx('ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
const assetSecuredUSDT = assetFromStringEx('ETH-USDT-0xdAC17F958D2ee523a2206206994597C13D831ec7')
const assetSynthUSDT = assetFromStringEx('ETH/USDT-0xdAC17F958D2ee523a2206206994597C13D831ec7')
const assetAvaxEth = { ...AssetETH, chain: AssetAVAX.chain, type: AssetType.TOKEN }
const assetBscEth = { ...AssetETH, chain: AssetBSC.chain, type: AssetType.TOKEN }

describe('AssetMenu.helper', () => {
  describe('getAssetSearchRank', () => {
    it('ranks native ETH.ETH first when searching eth', () => {
      expect(getAssetSearchRank(AssetETH, 'eth')).toBeLessThan(getAssetSearchRank(AssetBETH, 'eth'))
      expect(getAssetSearchRank(AssetETH, 'eth')).toBeLessThan(getAssetSearchRank(AssetAETH, 'eth'))
      expect(getAssetSearchRank(AssetETH, 'eth')).toBeLessThan(getAssetSearchRank(assetUSDT, 'eth'))
      expect(getAssetSearchRank(AssetETH, 'eth')).toBeLessThan(getAssetSearchRank(assetAvaxEth, 'eth'))
    })

    it('ranks L2 native ETH ahead of ERC-20s on ETH when searching eth', () => {
      expect(getAssetSearchRank(AssetBETH, 'eth')).toBeLessThan(getAssetSearchRank(assetUSDT, 'eth'))
      expect(getAssetSearchRank(AssetAETH, 'eth')).toBeLessThan(getAssetSearchRank(assetUSDC, 'eth'))
    })

    it('ranks native BTC.BTC first when searching btc', () => {
      expect(getAssetSearchRank(AssetBTC, 'btc')).toBe(0)
    })
  })

  describe('filterAndSortAssetsForMenu', () => {
    const poolOrder = [assetUSDT, assetUSDC, assetAvaxEth, AssetBETH, assetBscEth, AssetARB, AssetAETH, AssetETH]

    it('puts ETH.ETH first when typing eth (All filter)', () => {
      const sorted = filterAndSortAssetsForMenu(poolOrder, 'eth', ExtendedAssetType.All)
      expect(sorted[0]).toEqual(AssetETH)
    })

    it('puts ETH.ETH first when typing eth with Native filter', () => {
      const sorted = filterAndSortAssetsForMenu(poolOrder, 'eth', ExtendedAssetType.Native)
      expect(sorted[0]).toEqual(AssetETH)
      expect(sorted.every((a) => a.type === AssetType.NATIVE)).toBe(true)
      expect(sorted).not.toContainEqual(assetUSDT)
      expect(sorted).not.toContainEqual(assetUSDC)
    })

    it('keeps original order when search is empty', () => {
      expect(filterAndSortAssetsForMenu(poolOrder, '', ExtendedAssetType.All)).toEqual(poolOrder)
    })

    it('matches via assetMatchesSearch substring', () => {
      expect(assetMatchesSearch(assetUSDT, 'usdt')).toBe(true)
      expect(assetMatchesSearch(AssetETH, 'usdt')).toBe(false)
    })

    it('keeps L1 and secured USDT on All + usdt, drops synths', () => {
      const assets = [assetUSDT, assetSecuredUSDT, assetSynthUSDT, AssetETH]
      const sorted = filterAndSortAssetsForMenu(assets, 'usdt', ExtendedAssetType.All)
      expect(sorted).toContainEqual(assetUSDT)
      expect(sorted).toContainEqual(assetSecuredUSDT)
      expect(sorted).not.toContainEqual(assetSynthUSDT)
      expect(sorted.every((a) => a.type !== AssetType.SYNTH)).toBe(true)
    })

    it('returns no USDT matches on Native + usdt (token, not native)', () => {
      const assets = [assetUSDT, assetSecuredUSDT, assetSynthUSDT, AssetETH]
      const sorted = filterAndSortAssetsForMenu(assets, 'usdt', ExtendedAssetType.Native)
      expect(sorted).toEqual([])
    })

    it('keeps secured USDT on the Secured filter', () => {
      const assets = [assetUSDT, assetSecuredUSDT, assetSynthUSDT]
      const sorted = filterAndSortAssetsForMenu(assets, '', ExtendedAssetType.Secured)
      expect(sorted).toEqual([assetSecuredUSDT])
    })
  })

  describe('arrangeAssetsForMenu', () => {
    const poolOrder = [assetUSDT, assetUSDC, assetAvaxEth, AssetBETH, AssetARB, AssetAETH, AssetETH, AssetBTC]

    it('keeps pool order when nothing is starred', () => {
      expect(arrangeAssetsForMenu(poolOrder, '', ExtendedAssetType.All, [])).toEqual({
        kind: 'flat',
        assets: poolOrder
      })
    })

    it('pins favourites in star order and leaves the rest in pool order', () => {
      const arranged = arrangeAssetsForMenu(poolOrder, '', ExtendedAssetType.All, [AssetETH, assetUSDT])
      expect(arranged).toEqual({
        kind: 'sections',
        favourites: [AssetETH, assetUSDT],
        rest: [assetUSDC, assetAvaxEth, AssetBETH, AssetARB, AssetAETH, AssetBTC]
      })
    })

    it('keeps search rank ahead of a favourite', () => {
      const arranged = arrangeAssetsForMenu(poolOrder, 'eth', ExtendedAssetType.All, [assetUSDT])
      expect(arranged.kind).toBe('flat')
      if (arranged.kind !== 'flat') return
      expect(arranged.assets[0]).toEqual(AssetETH)
      expect(arranged.assets.indexOf(AssetETH)).toBeLessThan(arranged.assets.indexOf(assetUSDT))
    })

    it('lists only favourites, in star order, on the Favourites filter', () => {
      expect(arrangeAssetsForMenu(poolOrder, '', ExtendedAssetType.Favorite, [assetUSDT, AssetBTC])).toEqual({
        kind: 'flat',
        assets: [assetUSDT, AssetBTC]
      })
    })

    it('pins only the favourites that pass the Native filter', () => {
      const arranged = arrangeAssetsForMenu([assetUSDT, AssetETH, AssetBTC], '', ExtendedAssetType.Native, [
        assetUSDT,
        AssetBTC
      ])
      expect(arranged).toEqual({
        kind: 'sections',
        favourites: [AssetBTC],
        rest: [AssetETH]
      })
    })

    it('keeps secured USDT separate from token USDT', () => {
      const arranged = arrangeAssetsForMenu([assetUSDT, assetSecuredUSDT], '', ExtendedAssetType.All, [assetUSDT])
      expect(arranged).toEqual({
        kind: 'sections',
        favourites: [assetUSDT],
        rest: [assetSecuredUSDT]
      })
    })

    it('drops a favourite that is not in this menu', () => {
      expect(arrangeAssetsForMenu([AssetETH], '', ExtendedAssetType.All, [AssetBTC])).toEqual({
        kind: 'flat',
        assets: [AssetETH]
      })
    })
  })

  describe('showNoFavouritesHint', () => {
    it('shows the hint only when the saved list is empty', () => {
      expect(showNoFavouritesHint(ExtendedAssetType.Favorite, '', [])).toBe(true)
      expect(showNoFavouritesHint(ExtendedAssetType.Favorite, '  ', [])).toBe(true)
    })

    it('uses the usual empty result when saved favourites are missing from this picker', () => {
      expect(showNoFavouritesHint(ExtendedAssetType.Favorite, '', [AssetBTC])).toBe(false)
    })

    it('stays off while searching or on another filter', () => {
      expect(showNoFavouritesHint(ExtendedAssetType.Favorite, 'btc', [])).toBe(false)
      expect(showNoFavouritesHint(ExtendedAssetType.All, '', [])).toBe(false)
    })
  })
})
