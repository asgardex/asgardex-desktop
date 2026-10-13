import { AssetARB, AssetAETH } from '@xchainjs/xchain-arbitrum'
import { AssetAVAX } from '@xchainjs/xchain-avax'
import { AssetBETH } from '@xchainjs/xchain-base'
import { AssetBCH } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { ADAAsset } from '@xchainjs/xchain-cardano'
import { AssetETH } from '@xchainjs/xchain-ethereum'

import { SOLAsset } from '@xchainjs/xchain-solana'

import { AssetTRX } from '@xchainjs/xchain-tron'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'

import { eqAsset } from '../../renderer/helpers/fp/eq'
import { PoolDetails as PoolDetailsMaya } from '../../renderer/services/midgard/mayaMidgard/types'
import { PoolDetails } from '../../renderer/services/midgard/midgardTypes'
import {
  AssetRuneNative,
  AssetCacao,
  AssetMaya,
  AssetATOM,
  AssetBTC,
  AssetDASH,
  AssetDOGE,
  AssetLTC,
  AssetXRD,
  AssetZEC
} from './chainIds'

// Re-export to have asset definition at one place only to handle xchain-* changes easily in the future
export {
  AssetBTC,
  AssetDASH,
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
  AssetBETH,
  ADAAsset,
  AssetAETH,
  AssetXRD,
  SOLAsset,
  AssetTRX,
  AssetZEC
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
