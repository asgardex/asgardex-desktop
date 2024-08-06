import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

import { CHAIN_STRINGS, DEFAULT_ENABLED_CHAINS } from '../api/defaultChains'

export type EnabledChain = keyof typeof DEFAULT_ENABLED_CHAINS

// Function to get the enabled chains from storage, with a fallback to default chains

// /**
//  * Type guard
//  * whether `Chain` is `supported`
//  */
export const isSupportedChain = (u: string): u is EnabledChain =>
  Object.keys(DEFAULT_ENABLED_CHAINS).includes(u as EnabledChain)

// Mapping of DEXs to their supported chains, Update this when new chains are added
export const DEX_CHAINS: { [key: string]: ReadonlyArray<Chain> } = {
  MAYA: ['DASH', 'BTC', 'ETH', 'KUJI', 'THOR', 'MAYA', 'ARB'],
  // For THOR, filter out chains that are maya specific
  THOR: Object.keys(DEFAULT_ENABLED_CHAINS).filter((chain) => !['DASH', 'KUJI', 'MAYA', 'ARB'].includes(chain))
}

// Function to retrieve chains for a specific DEX
export const getChainsForDex = (dexName: string): ReadonlyArray<Chain> => {
  return DEX_CHAINS[dexName]
}

// Function to check if a chain is supported by MAYA DEX
export const isChainOfMaya = (chain: Chain): boolean => {
  const mayaChains = DEX_CHAINS[MAYAChain] // Retrieve MAYA's chains from the mapping
  return mayaChains.includes(chain)
}

// Function to check if a chain is supported by THOR DEX
export const isChainOfThor = (chain: Chain): boolean => {
  const thorChains = DEX_CHAINS[THORChain] // Retrieve THOR's chains from the mapping
  return thorChains.includes(chain)
}
/**
 * Convert chain to string.
 *
 * @param {Chain} chain.
 * @returns {string} The string based on the given chain type.
 *
 * TODO (@veado) Return `Maybe<string>` instead of throwing an error
 */
export const chainToString = (chain: Chain): string => {
  return CHAIN_STRINGS[chain] || `unknown chain ${chain}`
}

/**
 * Represents chain attributes.
 */
export type ChainAttributes = {
  blockReward: number
  avgBlockTimeInSecs: number
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
  },
  KUJI: {
    blockReward: 0,
    avgBlockTimeInSecs: 4
  },
  ARB: {
    blockReward: 0,
    avgBlockTimeInSecs: 3
  }
}
