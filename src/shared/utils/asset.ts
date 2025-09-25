import { AssetARB, AssetAETH } from '@xchainjs/xchain-arbitrum'
import { AssetAVAX } from '@xchainjs/xchain-avax'
import { AssetBETH } from '@xchainjs/xchain-base'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBCH } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { ADAAsset } from '@xchainjs/xchain-cardano'
import { AssetATOM } from '@xchainjs/xchain-cosmos'
import { AssetDASH } from '@xchainjs/xchain-dash'
import { AssetDOGE } from '@xchainjs/xchain-doge'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { AssetKUJI, AssetUSK } from '@xchainjs/xchain-kujira'
import { AssetLTC } from '@xchainjs/xchain-litecoin'
import { AssetCacao, AssetMaya } from '@xchainjs/xchain-mayachain'
import { AssetXRD } from '@xchainjs/xchain-radix'
import { SOLAsset } from '@xchainjs/xchain-solana'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { AssetTRX } from '@xchainjs/xchain-tron'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { AssetZEC } from '@xchainjs/xchain-zcash'

import { eqAsset } from '../../renderer/helpers/fp/eq'
import { PoolDetails as PoolDetailsMaya } from '../../renderer/services/midgard/mayaMigard/types'
import { PoolDetails } from '../../renderer/services/midgard/midgardTypes'

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
  AssetKUJI,
  AssetBETH,
  ADAAsset,
  AssetAETH,
  AssetXRD,
  SOLAsset,
  AssetUSK,
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
