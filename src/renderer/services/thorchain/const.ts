import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'

import { DEFAULT_THORNODE_API_URLS, DEFAULT_THORNODE_RPC_URLS } from '../../../shared/thorchain/const'
import { DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { ClientUrl, InteractState, MimirHalt } from './types'

export const INITIAL_INTERACT_STATE: InteractState = {
  step: 1,
  stepsTotal: 2,
  txRD: RD.initial
}

export const createDefaultMimirHalt = (): MimirHalt => {
  return Object.keys(DEFAULT_ENABLED_CHAINS).reduce(
    (acc, chain) => {
      acc[`HALT${chain}CHAIN`] = false
      acc[`HALT${chain}TRADING`] = false
      acc[`PAUSELP${chain}`] = false
      acc[`PAUSELPDEPOSIT-${chain}-${chain}`] = false
      return acc
    },
    {
      HALTTHORCHAIN: false,
      haltGlobalTrading: false,
      pauseGlobalLp: false
    } as MimirHalt
  )
}

export const DEFAULT_MIMIR_HALT = createDefaultMimirHalt()

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
