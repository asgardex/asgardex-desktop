import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'

import { DEFAULT_THORNODE_API_URLS, DEFAULT_THORNODE_RPC_URLS } from '../../../shared/thorchain/const'
import { DEFAULT_ENABLED_CHAINS, isSupportedChain } from '../../../shared/utils/chain'
import { getChainAsset } from '../../helpers/chainHelper'
import { ClientUrl, InteractState, MimirHalt } from './types'

export const INITIAL_INTERACT_STATE: InteractState = {
  step: 1,
  stepsTotal: 2,
  txRD: RD.initial
}

/**
 * Mimir key THORNode uses to pause LP deposits into a chain's gas-asset pool
 * (`PauseLPDeposit-<asset.MimirString()>`, x/thorchain/keeper/v1/keeper_halt.go IsPoolDepositPaused).
 */
export const getPoolDepositPauseMimirKey = (chain: Chain): string => {
  const symbol = isSupportedChain(chain) ? getChainAsset(chain).symbol : chain
  return `PAUSELPDEPOSIT-${chain.toUpperCase()}-${symbol.toUpperCase()}`
}

export const createDefaultMimirHalt = (): MimirHalt => {
  return Object.keys(DEFAULT_ENABLED_CHAINS).reduce(
    (acc, chain) => {
      acc[`HALT${chain}CHAIN`] = false
      acc[`HALT${chain}TRADING`] = false
      acc[`PAUSELP${chain}`] = false
      acc[getPoolDepositPauseMimirKey(chain) as keyof MimirHalt] = false
      return acc
    },
    {
      HALTTHORCHAIN: false,
      HALTTCYTRADING: false,
      haltGlobalTrading: false,
      pauseGlobalLp: false,
      haltStatusUnknown: false
    } as MimirHalt
  )
}

export const DEFAULT_MIMIR_HALT = createDefaultMimirHalt()

/**
 * Halt status that could not be loaded: every halt / pause flag is set, so all existing
 * `disable*Actions` checks block swaps, deposits, withdrawals and RUNE sends (fail closed).
 * `haltStatusUnknown` tells the UI that these flags are not real halts.
 */
export const createUnknownMimirHalt = (): MimirHalt =>
  Object.fromEntries(Object.keys(DEFAULT_MIMIR_HALT).map((key) => [key, true])) as MimirHalt

export const UNKNOWN_MIMIR_HALT = createUnknownMimirHalt()

export const RESERVE_MODULE_ADDRESS = 'thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt'

export const DEFAULT_CLIENT_URL: ClientUrl = {
  [Network.Testnet]: {
    node: DEFAULT_THORNODE_API_URLS.testnet,
    rpc: DEFAULT_THORNODE_RPC_URLS.testnet
  },
  [Network.Stagenet]: {
    node: DEFAULT_THORNODE_API_URLS.stagenet,
    rpc: DEFAULT_THORNODE_RPC_URLS.stagenet
  },
  [Network.Mainnet]: {
    node: DEFAULT_THORNODE_API_URLS.mainnet,
    rpc: DEFAULT_THORNODE_RPC_URLS.mainnet
  }
}
