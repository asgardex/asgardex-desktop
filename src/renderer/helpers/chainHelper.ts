import { AVAXChain, AssetAVAX } from '@xchainjs/xchain-avax'
import { AssetBNB, BNBChain } from '@xchainjs/xchain-binance'
import { AssetBTC, BTCChain } from '@xchainjs/xchain-bitcoin'
import { AssetBCH, BCHChain } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC, BSCChain } from '@xchainjs/xchain-bsc'
import { AssetATOM, GAIAChain } from '@xchainjs/xchain-cosmos'
import { AssetDASH, DASHChain } from '@xchainjs/xchain-dash'
import { AssetDOGE, DOGEChain } from '@xchainjs/xchain-doge'
import { AssetETH, ETHChain } from '@xchainjs/xchain-ethereum'
import { AssetLTC, LTCChain } from '@xchainjs/xchain-litecoin'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { Asset, Chain } from '@xchainjs/xchain-util'

import { isEnabledChain } from '../../shared/utils/chain'
import { eqChain } from './fp/eq'

// TODO (@veado) Return Maybe<Asset> instead of throwing an error
export const getChainAsset = (chain: Chain): Asset => {
  if (!isEnabledChain(chain)) throw Error(`${chain} is not supported for 'getChainAsset'`)
  switch (chain) {
    case BNBChain:
      return AssetBNB
    case BTCChain:
      return AssetBTC
    case ETHChain:
      return AssetETH
    case AVAXChain:
      return AssetAVAX
    case BSCChain:
      return AssetBSC
    case THORChain:
      return AssetRuneNative
    case MAYAChain:
      return AssetCacao
    case GAIAChain:
      return AssetATOM
    case BCHChain:
      return AssetBCH
    case LTCChain:
      return AssetLTC
    case DOGEChain:
      return AssetDOGE
    case DASHChain:
      return AssetDASH
  }
}

/**
 * Check whether chain is BTC chain
 */
export const isBtcChain = (chain: Chain): boolean => eqChain.equals(chain.toUpperCase(), BTCChain)

/**
 * Check whether chain is LTC chain
 */
export const isLtcChain = (chain: Chain): boolean => eqChain.equals(chain, LTCChain)

/**
 * Check whether chain is THOR chain
 */
export const isThorChain = (chain: Chain): boolean => eqChain.equals(chain.toUpperCase(), THORChain)

/**
 * Check whether chain is MAYA chain
 */
export const isMayaChain = (chain: Chain): boolean => eqChain.equals(chain, MAYAChain)

export const isDashChain = (chain: Chain): boolean => eqChain.equals(chain.toUpperCase(), DASHChain)

/**
 * Check whether chain is BNB chain
 */
export const isBnbChain = (chain: Chain): boolean => eqChain.equals(chain, BNBChain)

/**
 * Check whether chain is ETH chain
 */
export const isEthChain = (chain: Chain): boolean => eqChain.equals(chain.toUpperCase(), ETHChain)

/**
 * Check whether chain is AVAX chain
 */
export const isAvaxChain = (chain: Chain): boolean => eqChain.equals(chain, AVAXChain)

/**
 * Check whether chain is BSC chain
 */
export const isBscChain = (chain: Chain): boolean => eqChain.equals(chain, BSCChain)

/**
 * Check whether chain is BCH chain
 */
export const isBchChain = (chain: Chain): boolean => eqChain.equals(chain, BCHChain)

/**
 * Check whether chain is DOGE chain
 */
export const isDogeChain = (chain: Chain): boolean => eqChain.equals(chain, DOGEChain)

/**
 * Check whether chain is Cosmos (GAIA) chain
 */
export const isCosmosChain = (chain: Chain): boolean => eqChain.equals(chain, GAIAChain)

type ChainValues<T> = {
  [k in Chain]?: T[]
}

export const filterEnabledChains = <T>(values: ChainValues<T>): T[] => {
  const result: T[] = []
  Object.entries(values).forEach(([chain, value]) => {
    if (isEnabledChain(chain) && value) result.push(...value)
  })

  return result
}
