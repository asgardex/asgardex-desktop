import { Network } from '@xchainjs/xchain-client'

// Prefer the Liquify gateway over the public THORChain / MAYAChain endpoints.
//
// The xchainjs defaults list the public nodes (thornode.thorchain.network,
// midgard.thorchain.network, mayanode.mayachain.info, midgard.mayachain.info)
// FIRST and only fall back to Liquify. When the public nodes are slow or down —
// as they regularly are — every request storms the dead host first (a wall of
// console errors), and the methods that don't fail over (e.g. getQueue) break
// outright. Making Liquify primary avoids that while keeping the public nodes as
// a fallback.
//
// Mainnet only: stagenet/testnet keep the xchainjs network defaults.
export const LIQUIFY_THORNODE_URLS = [
  'https://gateway.liquify.com/chain/thorchain_api',
  'https://thornode.thorchain.network'
]
const LIQUIFY_MIDGARD_URLS = [
  'https://gateway.liquify.com/chain/thorchain_midgard',
  'https://midgard.thorchain.network'
]
const LIQUIFY_MAYANODE_URLS = ['https://api-maya.liquify.com', 'https://mayanode.mayachain.info']
const LIQUIFY_MAYA_MIDGARD_URLS = ['https://midgard-maya.liquify.com', 'https://midgard.mayachain.info']

const API_RETRIES = 3

/**
 * Endpoint overrides for `@xchainjs/xchain-aggregator` — Liquify primary, public
 * node fallback — covering both the Thorchain (thornode + midgard) and Mayachain
 * (mayanode + maya midgard) protocols. Returns `{}` for non-mainnet networks so
 * the aggregator keeps its own network defaults.
 */
export const liquifyAggregatorConfig = (network: Network) =>
  network === Network.Mainnet
    ? {
        thornodeConfig: { apiRetries: API_RETRIES, thornodeBaseUrls: LIQUIFY_THORNODE_URLS },
        midgardConfig: { apiRetries: API_RETRIES, midgardBaseUrls: LIQUIFY_MIDGARD_URLS },
        mayanodeConfig: { apiRetries: API_RETRIES, mayanodeBaseUrls: LIQUIFY_MAYANODE_URLS },
        mayaMidgardConfig: { apiRetries: API_RETRIES, midgardBaseUrls: LIQUIFY_MAYA_MIDGARD_URLS }
      }
    : {}
