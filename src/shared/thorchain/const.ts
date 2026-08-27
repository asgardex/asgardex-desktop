import { Network } from '@xchainjs/xchain-client'

import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

/** Public (rate-limited) Liquify Tendermint RPC — no API key. */
export const PUBLIC_LIQUIFY_THORNODE_RPC = 'https://gateway.liquify.com/chain/thorchain_rpc'

/** Public Liquify THORNode REST / LCD base — no API key. */
export const PUBLIC_LIQUIFY_THORNODE_API = 'https://gateway.liquify.com/chain/thorchain_api'

/** Public Liquify THOR Midgard base — no API key. */
export const PUBLIC_LIQUIFY_THORCHAIN_MIDGARD = 'https://gateway.liquify.com/chain/thorchain_midgard'

/**
 * Optional private mainnet THORNode fallbacks (full base URLs from env / GH secrets).
 * Not Liquify; empty when unset.
 */
export const ASGARDEX_THORNODE_API = envOrDefault(import.meta.env.VITE_ASGARDEX_THORNODE_API, '')
export const ASGARDEX_THORNODE_RPC = envOrDefault(import.meta.env.VITE_ASGARDEX_THORNODE_RPC, '')

/**
 * Liquify portal keys — Liquify gateway only (not private Asgardex fallbacks).
 * Same path form for API / RPC / Midgard; the key value selects the product:
 *   `https://gateway.liquify.com/api=<KEY>`
 * Never surface in Expert Mode / storage — only inject at request/client construction.
 */
export const LIQUIFY_THORCHAIN_API_KEY = envOrDefault(import.meta.env.VITE_LIQUIFY_THORCHAIN_API_KEY, '')
export const LIQUIFY_THORCHAIN_RPC_KEY = envOrDefault(import.meta.env.VITE_LIQUIFY_THORCHAIN_RPC_KEY, '')
export const LIQUIFY_THORCHAIN_MIDGARD_KEY = envOrDefault(import.meta.env.VITE_LIQUIFY_THORCHAIN_MIDGARD_KEY, '')

/** Build authenticated Liquify gateway URL from a portal key, or empty if unset. */
export const liquifyAuthenticatedUrl = (key: string): string => (key ? `https://gateway.liquify.com/api=${key}` : '')

/** True when URL is a Liquify portal authenticated path (`/api=…`). */
export const isLiquifyAuthenticatedUrl = (url: string): boolean => /^https:\/\/gateway\.liquify\.com\/api=/i.test(url)

/** @deprecated Use `isLiquifyAuthenticatedUrl` */
export const isLiquifyAuthenticatedRpcUrl = isLiquifyAuthenticatedUrl

/**
 * URL safe for Expert Mode UI and persistent storage (RPC field).
 * Strips Liquify `/api=<KEY>` endpoints back to the public RPC path.
 */
export const maskThornodeRpcUrl = (url: string): string =>
  isLiquifyAuthenticatedUrl(url) ? PUBLIC_LIQUIFY_THORNODE_RPC : url

/**
 * URL safe for Expert Mode UI and persistent storage (API field).
 * Strips Liquify `/api=<KEY>` endpoints back to the public API path.
 */
export const maskThornodeApiUrl = (url: string): string =>
  isLiquifyAuthenticatedUrl(url) ? PUBLIC_LIQUIFY_THORNODE_API : url

/**
 * URL safe for Expert Mode UI and persistent storage (Midgard field).
 * Strips Liquify `/api=<KEY>` endpoints back to the public Midgard path.
 */
export const maskMidgardUrl = (url: string): string =>
  isLiquifyAuthenticatedUrl(url) ? PUBLIC_LIQUIFY_THORCHAIN_MIDGARD : url

/**
 * Resolve the THORNode REST/LCD base used for queries (inbound_addresses, etc.).
 * Liquify portal API key injection is **mainnet only** — testnet/stagenet keep the
 * configured URL (including empty) so an empty stagenet does not hit mainnet Liquify.
 * On mainnet, when the key is set and the configured URL is empty or the public Liquify
 * API, use the authenticated portal URL. Custom Expert URLs are left alone.
 */
export const resolveThornodeApiUrl = (configured: string, network: Network = Network.Mainnet): string => {
  if (network !== Network.Mainnet) return configured

  const authenticated = liquifyAuthenticatedUrl(LIQUIFY_THORCHAIN_API_KEY)
  if (!authenticated) return configured

  const normalized = maskThornodeApiUrl(configured)
  if (!normalized || normalized === PUBLIC_LIQUIFY_THORNODE_API) {
    return authenticated
  }

  return normalized
}

/**
 * Resolve the Tendermint RPC URL used for signing/broadcast (and ledger).
 * Liquify portal RPC key injection is **mainnet only** (same reason as API).
 * On mainnet, when the key is set and the configured URL is empty or the public Liquify
 * RPC, use the authenticated portal URL. Custom Expert URLs are left alone.
 */
export const resolveThornodeRpcUrl = (configured: string, network: Network = Network.Mainnet): string => {
  if (network !== Network.Mainnet) return configured

  const authenticated = liquifyAuthenticatedUrl(LIQUIFY_THORCHAIN_RPC_KEY)
  if (!authenticated) return configured

  const normalized = maskThornodeRpcUrl(configured)
  if (!normalized || normalized === PUBLIC_LIQUIFY_THORNODE_RPC) {
    return authenticated
  }

  return normalized
}

/**
 * Resolve the THOR Midgard base URL.
 * Liquify portal Midgard key injection is **mainnet only**.
 * On mainnet, when the key is set and the configured URL is empty or the public Liquify
 * Midgard, use the authenticated portal URL. Custom Expert URLs are left alone.
 */
export const resolveMidgardUrl = (configured: string, network: Network = Network.Mainnet): string => {
  if (network !== Network.Mainnet) return configured

  const authenticated = liquifyAuthenticatedUrl(LIQUIFY_THORCHAIN_MIDGARD_KEY)
  if (!authenticated) return configured

  const normalized = maskMidgardUrl(configured)
  if (!normalized || normalized === PUBLIC_LIQUIFY_THORCHAIN_MIDGARD) {
    return authenticated
  }

  return normalized
}

/**
 * REST/LCD base URL list for app THORNode traffic and query/aggregator.
 * Mainnet: primary (Expert / Liquify API key) then optional Asgardex API fallback.
 * Other networks: primary only (no mainnet Liquify key injection).
 */
export const getThornodeApiBaseUrls = (configured: string, network: Network): string[] => {
  const primary = resolveThornodeApiUrl(configured, network)
  if (!primary) {
    return network === Network.Mainnet && ASGARDEX_THORNODE_API ? [ASGARDEX_THORNODE_API] : []
  }
  if (network !== Network.Mainnet) return [primary]
  if (!ASGARDEX_THORNODE_API || primary === ASGARDEX_THORNODE_API) return [primary]
  return [primary, ASGARDEX_THORNODE_API]
}

/**
 * Mainnet THORNode REST bases for xchain-query / aggregator round-robin.
 * Liquify (authenticated when API key set, else public) primary; Asgardex secondary when configured.
 * Dead `thornode.thorchain.network` omitted.
 */
export const THORNODE_API_BASE_URLS = getThornodeApiBaseUrls(PUBLIC_LIQUIFY_THORNODE_API, Network.Mainnet)

/**
 * RPC URL list for xchain Client `clientUrls` (round-robin).
 * Mainnet: primary (Expert / Liquify RPC key) then Asgardex RPC fallback when configured.
 * Other networks: primary only.
 */
export const getThornodeRpcClientUrls = (configured: string, network: Network): string[] => {
  const primary = resolveThornodeRpcUrl(configured, network)
  if (!primary) {
    return network === Network.Mainnet && ASGARDEX_THORNODE_RPC ? [ASGARDEX_THORNODE_RPC] : []
  }
  if (network !== Network.Mainnet) return [primary]
  if (!ASGARDEX_THORNODE_RPC || primary === ASGARDEX_THORNODE_RPC) return [primary]
  return [primary, ASGARDEX_THORNODE_RPC]
}

/**
 * Try each REST base with `request` until one succeeds (Liquify → Asgardex, etc.).
 */
export const requestThornodeApiBases = async <T>(
  bases: string[],
  request: (basePath: string) => Promise<T>
): Promise<T> => {
  if (bases.length === 0) throw new Error('No THORNode API bases configured')
  let lastError: Error | undefined
  for (const basePath of bases) {
    try {
      return await request(basePath)
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastError ?? new Error('All THORNode API bases failed')
}

export const DEFAULT_THORNODE_RPC_URLS: ApiUrls = {
  // Defaults stay public; authenticated URL is applied only via resolveThornodeRpcUrl()
  mainnet: maskThornodeRpcUrl(envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_RPC, PUBLIC_LIQUIFY_THORNODE_RPC)),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_RPC, ''),
  testnet: ''
}

export const DEFAULT_THORNODE_API_URLS: ApiUrls = {
  // Defaults stay public; authenticated URL is applied only via resolveThornodeApiUrl()
  mainnet: maskThornodeApiUrl(envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_API, PUBLIC_LIQUIFY_THORNODE_API)),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_API, ''),
  testnet: envOrDefault(import.meta.env.VITE_TESTNET_THORNODE_API, 'https://testnet.thornode.thorchain.info')
}
