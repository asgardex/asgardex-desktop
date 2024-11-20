import { Network } from '@xchainjs/xchain-client'

import { DEFAULT_USER_ASSETS } from '../renderer/const'
import { DEFAULT_NETWORK } from '../renderer/services/const'
import { PoolsStorageEncoded } from './api/io'
import {
  StoreFilesContent,
  UserAssetStorage,
  UserBondProvidersStorage,
  UserChainStorage,
  UserNodesStorage,
  UserTrustedAddressStorage
} from './api/types'
import { DEFAULT_EVM_HD_MODE } from './evm/types'
import { DEFAULT_LOCALE } from './i18n/const'
import { DEFAULT_MAYANODE_API_URLS, DEFAULT_MAYANODE_RPC_URLS } from './mayachain/const'
import { DEFAULT_MIDGARD_MAYA_URLS } from './mayaMidgard/const'
import { DEFAULT_MIDGARD_URLS } from './midgard/const'
import { DEFAULT_THORNODE_API_URLS, DEFAULT_THORNODE_RPC_URLS } from './thorchain/const'
import { DEFAULT_ENABLED_CHAINS, EnabledChain } from './utils/chain'
import { envOrDefault } from './utils/env'

require('dotenv').config()

// Check if the current network is production-like (mainnet or stagenet)
const isProductionNetwork = [Network.Stagenet].includes(DEFAULT_NETWORK)

// Asgardex Thorname (only for production-like networks)
export const ASGARDEX_THORNAME = isProductionNetwork
  ? envOrDefault(process.env.REACT_APP_ASGARDEX_THORNAME, 'dx')
  : undefined
export const ASGARDEX_IDENTIFIER = 999

// Asgardex full address
export const ASGARDEX_ADDRESS = 'thor1rr6rahhd4sy76a7rdxkjaen2q4k4pw2g06w7qp'

// Affiliate Fee in Basis Points (only for production-like networks)
export const ASGARDEX_AFFILIATE_FEE = isProductionNetwork ? 30 : undefined

// Affiliate Fee min apply value
export const ASGARDEX_AFFILIATE_FEE_MIN = 1001

// Header key for 9R endpoints
export const NINE_REALMS_CLIENT_HEADER = 'x-client-id'

export enum ExternalUrl {
  DOCSTHOR = 'https://docs.thorchain.org',
  DOCSMAYA = 'https://docs.mayaprotocol.com/',
  DISCORD = 'https://discord.gg/hWCeTncT',
  GITHUB_REPO = `https://github.com/asgardex/asgardex-desktop`,
  GITHUB_RELEASE = `https://github.com/asgardex/asgardex-desktop/releases/tag/v`,
  TWITTER = 'https://twitter.com/asgardex',
  ASGARDEX = 'https://asgardex.com',
  LICENSE = 'https://github.com/asgardex/asgardex-desktop?tab=MIT-1-ov-file'
}

// increase it by `1` if you want to ignore previous version of `UserNodesStorage`
const USER_NODES_STORAGE_VERSION = '1'

export const USER_NODES_STORAGE_DEFAULT: UserNodesStorage = {
  version: USER_NODES_STORAGE_VERSION,
  mainnet: [],
  stagenet: [],
  testnet: []
}
// increase it by `1` if you want to ignore previous version of `UserNodesStorage`
const USER_BOND_PROVIDERS_STORAGE_VERSION = '1'

export const USER_BOND_PROVIDERS_STORAGE_DEFAULT: UserBondProvidersStorage = {
  version: USER_BOND_PROVIDERS_STORAGE_VERSION,
  mainnet: [],
  stagenet: [],
  testnet: []
}

// increase it by `1` if you want to ignore previous version of `common` storage
const CHAINS_STORAGE_VERSION = '3'

export const CHAINS_STORAGE_DEFAULT: UserChainStorage = {
  version: CHAINS_STORAGE_VERSION,
  chains: Object.keys(DEFAULT_ENABLED_CHAINS) as EnabledChain[]
}

const ADDRESS_STORAGE_VERSION = '1'

export const ADDRESS_STORAGE_DEFAULT: UserTrustedAddressStorage = {
  version: ADDRESS_STORAGE_VERSION,
  addresses: []
}
/// increase it by `1` if you want to ignore previous version of `common` storage
const ASSETS_STORAGE_VERSION = '3'

export const ASSETS_STORAGE_DEFAULT: UserAssetStorage = {
  version: ASSETS_STORAGE_VERSION,
  assets: DEFAULT_USER_ASSETS
}
// increase it by `1` if you want to ignore previous version of `common` storage
const POOLS_STORAGE_VERSION = '1'

const POOLS_STORAGE_DEFAULT: PoolsStorageEncoded = {
  version: POOLS_STORAGE_VERSION,
  watchlists: {
    mainnet: [],
    stagenet: [],
    testnet: []
  }
}

// increase it by `1` if you want to ignore previous version of `common` storage
const COMMON_STORAGE_VERSION = '1'
/**
 * When adding a new store file do not forget to expose
 * public api for it at src/main/preload.ts
 */
export const DEFAULT_STORAGES: StoreFilesContent = {
  common: {
    version: COMMON_STORAGE_VERSION,
    evmDerivationMode: DEFAULT_EVM_HD_MODE,
    locale: DEFAULT_LOCALE,
    midgard: DEFAULT_MIDGARD_URLS,
    midgardMaya: DEFAULT_MIDGARD_MAYA_URLS,
    thornodeApi: DEFAULT_THORNODE_API_URLS,
    thornodeRpc: DEFAULT_THORNODE_RPC_URLS,
    mayanodeApi: DEFAULT_MAYANODE_API_URLS,
    mayanodeRpc: DEFAULT_MAYANODE_RPC_URLS
  },
  userChains: CHAINS_STORAGE_DEFAULT,
  userAddresses: ADDRESS_STORAGE_DEFAULT,
  userAssets: ASSETS_STORAGE_DEFAULT,
  userNodes: USER_NODES_STORAGE_DEFAULT,
  userBondProviders: USER_BOND_PROVIDERS_STORAGE_DEFAULT,
  pools: POOLS_STORAGE_DEFAULT
}
