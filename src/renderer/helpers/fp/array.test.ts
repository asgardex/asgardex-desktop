import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { Chain } from '@xchainjs/xchain-util'

import { AssetBSC, AssetBTC, AssetETH, AssetLTC } from '../../../shared/utils/asset'
import { unionAssets, unionChains } from './array'

describe('helpers/fp/array', () => {
  describe('unionChains', () => {
    it('merges two lists of chains and removes duplicates', () => {
      const chainsA: Chain[] = [BSCChain, ETHChain, BTCChain]
      const chainsB: Chain[] = [BSCChain, BTCChain, LTCChain]
      expect(unionChains(chainsA)(chainsB)).toEqual([BSCChain, BTCChain, LTCChain, ETHChain])
    })
  })
  describe('unionAssets', () => {
    it('merges two different lists of assets and removes duplicates', () => {
      const assetsA = [AssetBSC, AssetETH, AssetBTC]
      const assetsB = [AssetBSC, AssetBTC, AssetLTC]
      expect(unionAssets(assetsA)(assetsB)).toEqual([AssetBSC, AssetBTC, AssetLTC, AssetETH])
    })
    it('removes duplicates from same list', () => {
      const assets = [AssetBSC, AssetBSC, AssetETH, AssetETH]
      expect(unionAssets(assets)(assets)).toEqual([AssetBSC, AssetETH])
    })
  })
})
