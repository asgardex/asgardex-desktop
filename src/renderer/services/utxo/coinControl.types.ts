import type { UTXO } from '@xchainjs/xchain-utxo-providers'

export enum CoinControlStrategy {
  AUTO = 'auto',
  MANUAL = 'manual',
  MINIMIZE_FEE = 'minimizeFee',
  LARGEST_FIRST = 'largestFirst',
  SMALLEST_FIRST = 'smallestFirst'
}

export type CoinControlState = {
  strategy: CoinControlStrategy
  selectedUtxos: UTXO[]
  isEnabled: boolean
}

export const INITIAL_COIN_CONTROL_STATE: CoinControlState = {
  strategy: CoinControlStrategy.AUTO,
  selectedUtxos: [],
  isEnabled: false
}

export type UtxoSelectionPreferences = {
  minimizeFee?: boolean
  minimizeInputs?: boolean
  consolidateSmallUtxos?: boolean
}

/**
 * Maps CoinControlStrategy to xchainjs UtxoSelectionPreferences
 */
export const strategyToPreferences = (strategy: CoinControlStrategy): UtxoSelectionPreferences | undefined => {
  switch (strategy) {
    case CoinControlStrategy.MINIMIZE_FEE:
      return { minimizeFee: true }
    case CoinControlStrategy.LARGEST_FIRST:
      return { minimizeInputs: true }
    case CoinControlStrategy.SMALLEST_FIRST:
      return { consolidateSmallUtxos: true }
    case CoinControlStrategy.AUTO:
    case CoinControlStrategy.MANUAL:
    default:
      return undefined
  }
}

export type { UTXO }
