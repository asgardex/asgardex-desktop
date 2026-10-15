import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { describe, expect, it } from 'vitest'

import { toggleAssetInFavourites } from './assetFavourites'

describe('toggleAssetInFavourites', () => {
  it('appends a new asset and keeps the existing order', () => {
    expect(toggleAssetInFavourites([AssetETH], AssetBTC)).toEqual([AssetETH, AssetBTC])
  })

  it('removes an asset and leaves the others in place', () => {
    expect(toggleAssetInFavourites([AssetETH, AssetBTC, AssetBSC], AssetBTC)).toEqual([AssetETH, AssetBSC])
  })

  it('removes the first asset and leaves the rest in place', () => {
    expect(toggleAssetInFavourites([AssetETH, AssetBTC], AssetETH)).toEqual([AssetBTC])
  })
})
