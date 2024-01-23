import { AVAXChain } from '@xchainjs/xchain-avax'
import { BNBChain } from '@xchainjs/xchain-binance'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { ChainAttributes } from '@xchainjs/xchain-thorchain-query'
import { Chain } from '@xchainjs/xchain-util'

/**
 * All chains are currently supported by ASGDX
 * Whenever you want to support another chain, here is the first place to add it
 */
export const ENABLED_CHAINS = [
  BCHChain,
  BNBChain,
  BTCChain,
  GAIAChain,
  DOGEChain,
  ETHChain,
  LTCChain,
  THORChain,
  AVAXChain,
  BSCChain,
  MAYAChain,
  DASHChain
] as const

export type EnabledChain = typeof ENABLED_CHAINS[number]

/**
 * Type guard
 * whether `Chain` is `EnableChain`
 */
export const isEnabledChain = (u: string): u is EnabledChain => ENABLED_CHAINS.includes(u as EnabledChain)

/**
 * Convert chain to string.
 *
 * @param {Chain} chain.
 * @returns {string} The string based on the given chain type.
 *
 * TODO (@veado) Return `Maybe<string>` instead of throwing an error
 */
export const chainToString = (chain: Chain): string => {
  if (!isEnabledChain(chain)) return `unknown chain ${chain}`

  switch (chain) {
    case BCHChain:
      return 'Bitcoin Cash'
    case BNBChain:
      return 'BNB Beacon Chain'
    case BTCChain:
      return 'Bitcoin'
    case GAIAChain:
      return 'Cosmos'
    case DOGEChain:
      return 'Dogecoin'
    case ETHChain:
      return 'Ethereum'
    case LTCChain:
      return 'Litecoin'
    case THORChain:
      return 'THORChain'
    case AVAXChain:
      return 'Avax'
    case BSCChain:
      return 'BNB Chain (BSC)'
    case MAYAChain:
      return 'MAYAChain'
    case DASHChain:
      return 'DASH'
  }
}

export const DefaultChainAttributes: Record<Chain, ChainAttributes> = {
  BCH: {
    blockReward: 6.25,
    avgBlockTimeInSecs: 600
  },
  BTC: {
    blockReward: 6.25,
    avgBlockTimeInSecs: 600
  },
  ETH: {
    blockReward: 2,
    avgBlockTimeInSecs: 13
  },
  AVAX: {
    blockReward: 2,
    avgBlockTimeInSecs: 3
  },
  LTC: {
    blockReward: 12.5,
    avgBlockTimeInSecs: 150
  },
  DOGE: {
    blockReward: 10000,
    avgBlockTimeInSecs: 60
  },
  GAIA: {
    blockReward: 0,
    avgBlockTimeInSecs: 6
  },
  BNB: {
    blockReward: 0,
    avgBlockTimeInSecs: 6
  },
  THOR: {
    blockReward: 0,
    avgBlockTimeInSecs: 6
  },
  BSC: {
    blockReward: 0,
    avgBlockTimeInSecs: 3
  },
  MAYA: {
    blockReward: 0,
    avgBlockTimeInSecs: 6
  },
  DASH: {
    blockReward: 0,
    avgBlockTimeInSecs: 160
  }
}
