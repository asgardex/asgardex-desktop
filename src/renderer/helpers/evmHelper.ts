import { AnyAsset, Chain } from '@xchainjs/xchain-util'

import { isAethAsset, isAvaxAsset, isBscAsset, isEthAsset } from './assetHelper'
import { isArbChain, isAvaxChain, isBscChain, isEthChain } from './chainHelper'

/**
 * Helper function to determine if the chain is an EVM chain
 * @param chain - input
 * @returns boolean on if the chain is evm
 */
export const isEvmChain = (chain: Chain): Boolean => {
  return isEthChain(chain) || isAvaxChain(chain) || isBscChain(chain) || isArbChain(chain)
}

/**
 * Helper function to determine if the asset is not the chain/gas asset
 * @param asset - input
 * @returns - boolean if the asset is a erc/brc etc.
 */
export const isEvmToken = (asset: AnyAsset): Boolean => {
  return !isEthAsset(asset) || !isAethAsset(asset) || !isAvaxAsset(asset) || !isBscAsset(asset)
}
