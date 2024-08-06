import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'

import { DEFAULT_MAYANODE_API_URLS, DEFAULT_MAYANODE_RPC_URLS } from '../../../shared/mayachain/const'
import { DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { ClientUrl } from '../thorchain/types'
import { InteractState, MimirHalt } from './types'

export const INITIAL_INTERACT_STATE: InteractState = {
  step: 1,
  stepsTotal: 2,
  txRD: RD.initial
}

export const createDefaultMimirHalt = (): MimirHalt => {
  return Object.keys(DEFAULT_ENABLED_CHAINS).reduce(
    (acc, chain) => {
      acc[`halt${chain}Chain`] = false
      acc[`halt${chain}Trading`] = false
      acc[`pauseLp${chain}`] = false
      return acc
    },
    {
      haltMAYAChain: false,
      haltTrading: false,
      pauseLp: false
    } as MimirHalt
  )
}

export const DEFAULT_MIMIR_HALT = createDefaultMimirHalt()

export const DEFAULT_CLIENT_URL: ClientUrl = {
  [Network.Testnet]: {
    node: DEFAULT_MAYANODE_API_URLS.testnet,
    rpc: DEFAULT_MAYANODE_RPC_URLS.testnet
  },
  [Network.Stagenet]: {
    node: DEFAULT_MAYANODE_API_URLS.stagenet,
    rpc: DEFAULT_MAYANODE_RPC_URLS.stagenet
  },
  [Network.Mainnet]: {
    node: DEFAULT_MAYANODE_API_URLS.mainnet,
    rpc: DEFAULT_MAYANODE_RPC_URLS.mainnet
  }
}
