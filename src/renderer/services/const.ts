import * as Client from '@xchainjs/xchain-client'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'

import { Dex } from '../../shared/api/types'
import { envOrDefault } from '../../shared/utils/env'
import { isNetwork } from '../../shared/utils/guard'
import { SlipTolerance } from '../types/asgardex'

export const DEFAULT_SLIP_TOLERANCE: SlipTolerance = 3
export const DEFAULT_CLIENT_NETWORK: Client.Network = Client.Network.Mainnet

/**
 * Enabled networks -`stagenet` + `mainnet` by default
 * Can be overridden by `REACT_APP_NETWORKS` defined in `.env`
 */
export const AVAILABLE_NETWORKS: Network[] = envOrDefault(process.env.REACT_APP_NETWORKS, 'stagenet,mainnet')
  .replace(/\s/g, '')
  .split(',')
  .filter(isNetwork)

/**
 * Enabled networks -`stagenet` + `mainnet` by default
 * Can be overridden by `REACT_APP_NETWORKS` defined in `.env`
 */
export const AVAILABLE_DEXS: Dex[] = [THORChain, MAYAChain]

const ENV_NETWORK = process.env.REACT_APP_DEFAULT_NETWORK

/**
 * Default network - `mainnet` by default
 * Can be overridden by `REACT_APP_DEFAULT_NETWORK` defined in `.env`
 * But in `dev` mode only
 */
export const DEFAULT_NETWORK: Network =
  process.env.NODE_ENV !== 'production' && isNetwork(ENV_NETWORK) && AVAILABLE_NETWORKS.includes(ENV_NETWORK)
    ? ENV_NETWORK
    : Network.Mainnet

// Pagination: max. number of items
export const MAX_ITEMS_PER_PAGE = 10

export const MIDGARD_MAX_RETRY = 3

export const DEFAULT_DEX = THORChain
