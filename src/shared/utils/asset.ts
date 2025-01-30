import { AssetARB } from '@xchainjs/xchain-arbitrum'
import { AssetAVAX } from '@xchainjs/xchain-avax'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBCH } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { AssetATOM } from '@xchainjs/xchain-cosmos'
import { AssetDOGE } from '@xchainjs/xchain-doge'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { AssetKUJI } from '@xchainjs/xchain-kujira'
import { AssetLTC } from '@xchainjs/xchain-litecoin'
import { AssetCacao, AssetMaya } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'

import { eqAsset } from '../../renderer/helpers/fp/eq'
import { PoolDetails as PoolDetailsMaya } from '../../renderer/services/mayaMigard/types'
import { PoolDetails } from '../../renderer/services/midgard/types'
import { AssetBETH } from '../base/const'

// Re-export to have asset definition at one place only to handle xchain-* changes easily in the future
export {
  AssetBTC,
  AssetCacao,
  AssetMaya,
  AssetBCH,
  AssetATOM,
  AssetLTC,
  AssetDOGE,
  AssetBSC,
  AssetARB,
  AssetAVAX,
  AssetETH,
  AssetRuneNative,
  AssetKUJI,
  AssetBETH
}

export const isTCSupportedAsset = (asset: AnyAsset, poolDetails: PoolDetails) => {
  if (eqAsset.equals(asset, AssetRuneNative)) return true

  const assets = poolDetails.map((poolDetail) => poolDetail.asset.toUpperCase())

  if (assets.includes(assetToString(asset).toUpperCase())) return true
  if (assets.includes(assetToString(asset).replace('-', '.').toUpperCase())) return true
  if (assets.includes(assetToString(asset).replace('~', '.').toUpperCase())) return true

  return false
}

export const isMayaSupportedAsset = (asset: AnyAsset, poolDetails: PoolDetailsMaya) => {
  if (eqAsset.equals(asset, AssetCacao)) return true

  const assets = poolDetails.map((poolDetail) => poolDetail.asset.toUpperCase())

  if (assets.includes(assetToString(asset).toUpperCase())) return true
  if (assets.includes(assetToString(asset).replace('/', '.').toUpperCase())) return true

  return false
}
