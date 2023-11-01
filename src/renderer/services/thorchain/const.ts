import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { ChainIds, ClientUrl } from '@xchainjs/xchain-thorchain'

import { DEFAULT_THORNODE_API_URLS, DEFAULT_THORNODE_RPC_URLS } from '../../../shared/thorchain/const'
import { ENABLED_CHAINS } from '../../../shared/utils/chain'
import { InteractState, MimirHalt } from './types'

export const INITIAL_INTERACT_STATE: InteractState = {
  step: 1,
  stepsTotal: 2,
  txRD: RD.initial
}

export const createDefaultMimirHalt = (): MimirHalt => {
  return ENABLED_CHAINS.reduce(
    (acc, chain) => {
      acc[`halt${chain}Chain`] = false
      acc[`halt${chain}Trading`] = false
      acc[`pauseLp${chain}`] = false
      return acc
    },
    {
      haltTHORChain: false,
      haltTrading: false,
      pauseLp: false
    } as MimirHalt
  )
}

export const DEFAULT_MIMIR_HALT = createDefaultMimirHalt()

export const RESERVE_MODULE_ADDRESS = 'thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt'

// 'unknown' by default - needed to be requested from THORNode before initializing a `xchain-thorchain` client
export const INITIAL_CHAIN_IDS: ChainIds = {
  [Network.Mainnet]: 'thorchain-mainnet-v1',
  [Network.Stagenet]: 'thorchain-stagenet-v2',
  [Network.Testnet]: 'unkown-testnet-chain-id'
}

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
// const DEFAULT_URL_DOMAIN = 'track.ninerealms.com'
// const DEFAULT_HTTPS = 'https://'

// const buildExplorerUrl = (subdomain = '', path = '') => {
//   return `${DEFAULT_HTTPS}${subdomain ? `${subdomain}.` : ''}${DEFAULT_URL_DOMAIN}${path}`
// }

// export const DEFAULT_EXPLORER_URLS = {
//   root: {
//     [Network.Testnet]: buildExplorerUrl(),
//     [Network.Stagenet]: buildExplorerUrl('stagenet'),
//     [Network.Mainnet]: buildExplorerUrl()
//   },
//   tx: {
//     [Network.Testnet]: buildExplorerUrl('', '/tx'),
//     [Network.Stagenet]: buildExplorerUrl('stagenet', '/tx'),
//     [Network.Mainnet]: buildExplorerUrl('', '/tx')
//   },
//   address: {
//     [Network.Testnet]: buildExplorerUrl('', '/address'),
//     [Network.Stagenet]: buildExplorerUrl('stagenet', '/address'),
//     [Network.Mainnet]: buildExplorerUrl('', '/address')
//   }
// }
