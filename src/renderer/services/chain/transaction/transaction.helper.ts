import { ARBChain, ARB_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-arbitrum'
import { AVAXChain, AVAX_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-avax'
import { BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCH_DECIMAL } from '@xchainjs/xchain-bitcoincash'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain, BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { COSMOS_DECIMAL } from '@xchainjs/xchain-cosmos'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain, DASH_DECIMAL } from '@xchainjs/xchain-dash'
import { DOGE_DECIMAL } from '@xchainjs/xchain-doge'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETH_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-ethereum'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTC_DECIMAL } from '@xchainjs/xchain-litecoin'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { CACAO_DECIMAL, MAYAChain } from '@xchainjs/xchain-mayachain'
import { RUNE_DECIMAL as THOR_DECIMAL } from '@xchainjs/xchain-thorchain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import { Chain } from '@xchainjs/xchain-util'

import { isSupportedChain } from '../../../../shared/utils/chain'
import { KUJI_DECIMAL } from '../../kuji/const'

/**
 * Returns minimal amount (threshold) needed to send a tx on given chain
 */
export const smallestAmountToSent = (chain: Chain, _network: Network): BaseAmount => {
  if (!isSupportedChain(chain)) throw Error(`${chain} is not supported for 'smallestAmountToSent$'`)

  switch (chain) {
    case BTCChain:
      // 1000 satoshi
      return baseAmount(1000, BTC_DECIMAL)
    case DASHChain:
      // 1000 duff
      return baseAmount(1000, DASH_DECIMAL)
    case THORChain:
      // 0 thor
      return baseAmount(0, THOR_DECIMAL)
    case MAYAChain:
      // 0 cacao
      return baseAmount(0, CACAO_DECIMAL)
    case ETHChain:
      // zero for ETH
      return baseAmount(0, ETH_GAS_ASSET_DECIMAL)
    case ARBChain:
      // zero for Arb
      return baseAmount(0, ARB_GAS_ASSET_DECIMAL)
    case AVAXChain:
      // zero for Avax
      return baseAmount(0, AVAX_GAS_ASSET_DECIMAL)
    case BSCChain:
      // zero for bsc
      return baseAmount(0, BSC_GAS_ASSET_DECIMAL)
    case GAIAChain:
      return baseAmount(1, COSMOS_DECIMAL)
    case DOGEChain:
      // 1000 satoshi
      return baseAmount(1000, DOGE_DECIMAL)
    case KUJIChain:
      return baseAmount(5000, KUJI_DECIMAL)
    case BCHChain:
      // 1000 satoshi
      return baseAmount(1000, BCH_DECIMAL)
    case LTCChain:
      // 1000 satoshi
      return baseAmount(1000, LTC_DECIMAL)
    default:
      throw Error(`${chain} is not supported for 'smallestAmountToSent$'`)
  }
}
