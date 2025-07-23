import { ARBChain, ARB_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-arbitrum'
import { AVAXChain, AVAX_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-avax'
import { BASEChain, BASE_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-base'
import { BTC_DECIMAL, BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCH_DECIMAL, BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain, BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { ADAChain, ADA_DECIMALS } from '@xchainjs/xchain-cardano'
import { Network } from '@xchainjs/xchain-client'
import { COSMOS_DECIMAL, GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain, DASH_DECIMAL } from '@xchainjs/xchain-dash'
import { DOGE_DECIMAL, DOGEChain } from '@xchainjs/xchain-doge'
import { ETH_GAS_ASSET_DECIMAL, ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTC_DECIMAL, LTCChain } from '@xchainjs/xchain-litecoin'
import { CACAO_DECIMAL, MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain, XRD_DECIMAL } from '@xchainjs/xchain-radix'
import { XRP_DECIMAL, XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain, SOL_DECIMALS } from '@xchainjs/xchain-solana'
import { RUNE_DECIMAL as THOR_DECIMAL, THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount, baseAmount, Chain } from '@xchainjs/xchain-util'
import { ZEC_DECIMAL, ZECChain } from '@xchainjs/xchain-zcash'

import { isSupportedChain } from '../../../../shared/utils/chain'
import { KUJI_DECIMAL } from '../../kuji/const'

/**
 * Returns minimal amount (dust threshold) needed to send a tx for Thorchain to acknowledge
 */
export const smallestAmountToSend = (chain: Chain, _network: Network): BaseAmount => {
  if (!isSupportedChain(chain)) throw Error(`${chain} is not supported for 'smallestAmountToSend$'`)

  switch (chain) {
    case BTCChain:
      // 10001 satoshi
      return baseAmount(10001, BTC_DECIMAL)
    case DASHChain:
      // 10001 duff
      return baseAmount(10001, DASH_DECIMAL)
    case THORChain:
      // 0 thor
      return baseAmount(0, THOR_DECIMAL)
    case MAYAChain:
      // 0 cacao
      return baseAmount(0, CACAO_DECIMAL)
    case ETHChain:
      return baseAmount(10000000000, ETH_GAS_ASSET_DECIMAL)
    case ARBChain:
      return baseAmount(1000000000, ARB_GAS_ASSET_DECIMAL)
    case AVAXChain:
      return baseAmount(10000000000, AVAX_GAS_ASSET_DECIMAL)
    case BASEChain:
      return baseAmount(10000000000, BASE_GAS_ASSET_DECIMAL)
    case BSCChain:
      return baseAmount(10000000000, BSC_GAS_ASSET_DECIMAL)
    case GAIAChain:
      return baseAmount(1, COSMOS_DECIMAL)
    case DOGEChain:
      // 100000000 satoshi
      return baseAmount(100000000, DOGE_DECIMAL)
    case KUJIChain:
      return baseAmount(5000, KUJI_DECIMAL)
    case ADAChain:
      // 1170000 love lace
      return baseAmount(1170000, ADA_DECIMALS)
    case BCHChain:
      // 10001 satoshi
      return baseAmount(10001, BCH_DECIMAL)
    case LTCChain:
      // 10001 satoshi
      return baseAmount(10001, LTC_DECIMAL)
    case RadixChain:
      return baseAmount(100000000000000000, XRD_DECIMAL)
    case SOLChain:
      return baseAmount(1, SOL_DECIMALS)
    case ZECChain:
      // 1000 zatoshi
      return baseAmount(10001, ZEC_DECIMAL)
    case XRPChain:
      // 1 drop
      return baseAmount(1000000, XRP_DECIMAL)
    default:
      throw Error(`${chain} is not supported for 'smallestAmountToSend$'`)
  }
}
