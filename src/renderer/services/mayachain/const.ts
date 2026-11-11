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

const createDefaultMimirHalt = (): MimirHalt => {
  return Object.keys(DEFAULT_ENABLED_CHAINS).reduce(
    (acc, chain) => {
      acc[`HALT${chain}CHAIN`] = false
      acc[`HALT${chain}TRADING`] = false
      acc[`PAUSELP${chain}`] = false
      return acc
    },
    {
      HALTMAYACHAIN: false,
      haltGlobalTrading: false,
      pauseGlobalLp: false,
      haltStatusUnknown: false
    } as MimirHalt
  )
}

export const DEFAULT_MIMIR_HALT = createDefaultMimirHalt()

/**
 * Halt status that could not be loaded: every halt / pause flag is set, so the `disable*Actions` checks
 * block deposits (fail closed).
 * `haltStatusUnknown` tells the UI that these flags are not real halts. Swaps and swap quotes drop them
 * (`resolveSwapHaltState`): an unknown status alone does not block a swap, the node quote decides.
 */
export const createUnknownMimirHalt = (): MimirHalt =>
  Object.fromEntries(Object.keys(createDefaultMimirHalt()).map((key) => [key, true])) as MimirHalt

export const UNKNOWN_MIMIR_HALT = createUnknownMimirHalt()

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
