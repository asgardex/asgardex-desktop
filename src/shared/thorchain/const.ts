import { Network } from '@xchainjs/xchain-client'

import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

/** Public (rate-limited) Liquify Tendermint RPC — no API key. */
export const PUBLIC_LIQUIFY_THORNODE_RPC = 'https://gateway.liquify.com/chain/thorchain_rpc'

/** Public Liquify THORNode REST / LCD base — no API key. */
export const PUBLIC_LIQUIFY_THORNODE_API = 'https://gateway.liquify.com/chain/thorchain_api'

/**
 * Optional private mainnet THORNode fallbacks (full base URLs from env / GH secrets).
 * Not Liquify; empty when unset.
 */
export const ASGARDEX_THORNODE_API = envOrDefault(import.meta.env.VITE_ASGARDEX_THORNODE_API, '')
export const ASGARDEX_THORNODE_RPC = envOrDefault(import.meta.env.VITE_ASGARDEX_THORNODE_RPC, '')

/**
 * Liquify portal keys are NOT part of renderer / shared code any more.
 * They are `VITE_LIQUIFY_*` env vars read in the Electron main process only and sent as an
 * `X-API-KEY` header by `src/main/api/liquifyAuth.ts`. The renderer only ever sees public URLs.
 *
 * `isLiquifyAuthenticatedUrl` + the `mask*` helpers below remain so legacy persisted URLs of the
 * form `https://gateway.liquify.com/api=<KEY>` (older builds / Expert Mode) are migrated away.
 */

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
 * REST/LCD base URL list for app THORNode traffic and query/aggregator.
 * Mainnet: primary (Expert / public Liquify gateway) then optional Asgardex API fallback.
 * Other networks: primary only. Liquify keys are injected by the main process (header), never here.
 */
export const getThornodeApiBaseUrls = (configured: string, network: Network): string[] => {
  const primary = maskThornodeApiUrl(configured)
  if (!primary) {
    return network === Network.Mainnet && ASGARDEX_THORNODE_API ? [ASGARDEX_THORNODE_API] : []
  }
  if (network !== Network.Mainnet) return [primary]
  if (!ASGARDEX_THORNODE_API || primary === ASGARDEX_THORNODE_API) return [primary]
  return [primary, ASGARDEX_THORNODE_API]
}

/**
 * Mainnet THORNode REST bases for xchain-query / aggregator round-robin.
 * Liquify public gateway primary (key header added by main); Asgardex secondary when configured.
 * Dead `thornode.thorchain.network` omitted.
 */
export const THORNODE_API_BASE_URLS = getThornodeApiBaseUrls(PUBLIC_LIQUIFY_THORNODE_API, Network.Mainnet)

/**
 * RPC URL list for xchain Client `clientUrls` (round-robin).
 * Mainnet: primary (Expert / public Liquify gateway) then Asgardex RPC fallback when configured.
 * Other networks: primary only.
 */
export const getThornodeRpcClientUrls = (configured: string, network: Network): string[] => {
  const primary = maskThornodeRpcUrl(configured)
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
  // Defaults stay public; the key (if any) is sent as a header by the main process
  mainnet: maskThornodeRpcUrl(envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_RPC, PUBLIC_LIQUIFY_THORNODE_RPC)),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_RPC, ''),
  testnet: ''
}

export const DEFAULT_THORNODE_API_URLS: ApiUrls = {
  // Defaults stay public; the key (if any) is sent as a header by the main process
  mainnet: maskThornodeApiUrl(envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_API, PUBLIC_LIQUIFY_THORNODE_API)),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_API, ''),
  testnet: envOrDefault(import.meta.env.VITE_TESTNET_THORNODE_API, 'https://testnet.thornode.thorchain.info')
}
