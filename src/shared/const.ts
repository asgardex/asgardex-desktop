import { Network } from '@xchainjs/xchain-client'

import { DEFAULT_USER_ASSETS } from '../renderer/const'
import { PoolsStorageEncoded } from './api/io'
import {
  StoreFilesContent,
  UserAssetStorage,
  UserBondProvidersStorage,
  UserChainStorage,
  UserNodesStorage,
  UserTrustedAddressStorage
} from './api/types'
import { DEFAULT_ARB_RPC_URLS } from './arb/const'
import { DEFAULT_AVAX_RPC_URLS } from './avax/const'
import { DEFAULT_BASE_RPC_URLS } from './base/const'
import { DEFAULT_BSC_RPC_URLS } from './bsc/const'
import { DEFAULT_ETH_RPC_URLS } from './ethereum/const'
import { DEFAULT_EVM_HD_MODE } from './evm/types'
import { DEFAULT_LOCALE } from './i18n/const'
import { DEFAULT_MAYANODE_API_URLS, DEFAULT_MAYANODE_RPC_URLS } from './mayachain/const'
import { DEFAULT_MIDGARD_MAYA_URLS } from './mayaMidgard/const'
import { DEFAULT_MIDGARD_URLS } from './midgard/const'
import { DEFAULT_THORNODE_API_URLS, DEFAULT_THORNODE_RPC_URLS } from './thorchain/const'
import { DEFAULT_ENABLED_CHAINS, EnabledChain } from './utils/chain'
import { envOrDefault } from './utils/env'

export const ASGARDEX_ADDRESS = 'thor1rr6rahhd4sy76a7rdxkjaen2q4k4pw2g06w7qp'

export const ASGARDEX_AFFILIATE_FEE = 30
export const ASGARDEX_THORNAME = envOrDefault(import.meta.env.VITE_ASGARDEX_THORNAME, 'dx')

// Chainflip broker configuration
export const ASGARDEX_BROKER_URL = envOrDefault(import.meta.env.VITE_ASGARDEX_BROKER_URL, '')
export const ASGARDEX_AFFILIATE_BROKERS_ADDRESS = envOrDefault(
  import.meta.env.VITE_ASGARDEX_AFFILIATE_BROKERS_ADDRESS as `cF${string}`,
  ''
)

// OneClick (NEAR Intents) configuration
// API key is optional — 1Click works anonymously but rate-limits more aggressively.
export const ASGARDEX_ONECLICK_API_KEY = envOrDefault(import.meta.env.VITE_ASGARDEX_ONECLICK_API_KEY, '')

// 1Click pays the affiliate fee on the destination chain, so the recipient must be
// a native address on that chain. Configure as a JSON map of chain → address, e.g.
// VITE_ASGARDEX_ONECLICK_AFFILIATES='{"BTC":"bc1...","ETH":"0x..."}'
// When the destination chain has no entry, no affiliate fee is applied to that quote.
const parseOneClickAffiliates = (raw: string): Record<string, string> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      // eslint-disable-next-line no-console -- shared module, no logger available at env-parse time
      console.warn(
        'VITE_ASGARDEX_ONECLICK_AFFILIATES must be a JSON object mapping chain → address, e.g. {"ETH":"0x..."} — affiliate fees disabled'
      )
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([chain, address]) => {
        if (typeof address !== 'string' || chain.trim() === '' || address.trim() === '') {
          // eslint-disable-next-line no-console -- shared module, no logger available at env-parse time
          console.warn(`VITE_ASGARDEX_ONECLICK_AFFILIATES: skipping invalid entry for "${chain}"`)
          return []
        }
        // Lookup happens by xchainjs chain id (e.g. 'ETH'), so normalize keys —
        // a lowercase "eth" in .env should still match.
        return [[chain.trim().toUpperCase(), address.trim()]]
      })
    )
  } catch {
    // eslint-disable-next-line no-console -- shared module, no logger available at env-parse time
    console.warn(
      'VITE_ASGARDEX_ONECLICK_AFFILIATES is not valid JSON — affiliate fees disabled. Expected e.g. {"ETH":"0x..."}'
    )
    return {}
  }
}
export const ASGARDEX_ONECLICK_AFFILIATES: Record<string, string> = parseOneClickAffiliates(
  envOrDefault(import.meta.env.VITE_ASGARDEX_ONECLICK_AFFILIATES, '')
)

export const getAsgardexThorname = (network: Network): string | undefined =>
  network === Network.Mainnet ? ASGARDEX_THORNAME : undefined

export const getAsgardexAffiliateFee = (network: Network): number | undefined =>
  network === Network.Mainnet ? ASGARDEX_AFFILIATE_FEE : undefined

// Affiliate Fee min apply value
export const ASGARDEX_AFFILIATE_FEE_MIN = 1001

export enum ExternalUrl {
  DOCSTHOR = 'https://docs.thorchain.org',
  DOCSMAYA = 'https://docs.mayaprotocol.com/',
  DISCORD = 'https://discord.gg/bzvbD7tdZv',
  GITHUB_REPO = `https://github.com/asgardex/asgardex-desktop`,
  GITHUB_RELEASE = `https://github.com/asgardex/asgardex-desktop/releases/tag/v`,
  TWITTER = 'https://x.com/asgardex',
  ASGARDEX = 'https://asgardex.com',
  LICENSE = 'https://github.com/asgardex/asgardex-desktop?tab=MIT-1-ov-file'
}

export const INVALID_PATH_SEGMENT = /[\\/]|\.\./
export const VALID_SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/

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

// Default gas multiplier (1x = normal gas price)
export const DEFAULT_EVM_GAS_MULTIPLIER = 1 as const

/**
 * Bounded transport creation for Ledger devices. Without this,
 * `TransportNodeHidSingleton.default.create()` hangs forever when the device is on a
 * power-only USB cable, locked, busy with another app, or otherwise unresponsive.
 */
export const LEDGER_TRANSPORT_TIMEOUT_MS = 10_000

/**
 * Renderer-side ceiling for the full IPC round-trip. Derived from the main-process
 * transport timeout so the inner timeout always wins the race and surfaces the more
 * specific error to the user.
 */
export const LEDGER_IPC_TIMEOUT_MS = LEDGER_TRANSPORT_TIMEOUT_MS + 10_000

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
    mayanodeRpc: DEFAULT_MAYANODE_RPC_URLS,
    ethRpc: DEFAULT_ETH_RPC_URLS,
    bscRpc: DEFAULT_BSC_RPC_URLS,
    arbRpc: DEFAULT_ARB_RPC_URLS,
    avaxRpc: DEFAULT_AVAX_RPC_URLS,
    baseRpc: DEFAULT_BASE_RPC_URLS,
    evmGasMultiplier: DEFAULT_EVM_GAS_MULTIPLIER
  },
  userChains: CHAINS_STORAGE_DEFAULT,
  userAddresses: ADDRESS_STORAGE_DEFAULT,
  userAssets: ASSETS_STORAGE_DEFAULT,
  userNodes: USER_NODES_STORAGE_DEFAULT,
  userBondProviders: USER_BOND_PROVIDERS_STORAGE_DEFAULT,
  pools: POOLS_STORAGE_DEFAULT
}
