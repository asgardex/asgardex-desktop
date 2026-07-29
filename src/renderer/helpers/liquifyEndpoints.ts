import { Network } from '@xchainjs/xchain-client'

import { THORNODE_API_BASE_URLS } from '../../shared/thorchain/const'

// Prefer the Liquify gateway over the public THORChain / MAYAChain endpoints.
//
// The xchainjs defaults list the public nodes (thornode.thorchain.network,
// midgard.thorchain.network, mayanode.mayachain.info, midgard.mayachain.info)
// FIRST and only fall back to Liquify. When the public nodes are slow or down —
// as they regularly are — every request storms the dead host first (a wall of
// console errors), and the methods that don't fail over (e.g. getQueue) break
// outright. Making Liquify primary avoids that while keeping a healthy fallback.
//
// Mainnet only: stagenet/testnet keep the xchainjs network defaults.
// THORNode: Liquify → Asgardex-hosted node (replaces dead thornode.thorchain.network).
export const LIQUIFY_THORNODE_URLS = THORNODE_API_BASE_URLS

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
