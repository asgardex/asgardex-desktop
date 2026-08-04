import { Network } from '@xchainjs/xchain-client'

import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

/** Public (rate-limited) Liquify Tendermint RPC — no API key. */
export const PUBLIC_LIQUIFY_THORNODE_RPC = 'https://gateway.liquify.com/chain/thorchain_rpc'

/** Public Liquify THORNode REST / LCD base. */
export const PUBLIC_LIQUIFY_THORNODE_API = 'https://gateway.liquify.com/chain/thorchain_api'

/**
 * Asgardex-hosted THORNode fallbacks (REST + LCD under `/api`, CometBFT under `/rpc`).
 * Injected at build time via env / GH secrets — empty when unset (local dev without .env).
 */
export const ASGARDEX_THORNODE_API = envOrDefault(import.meta.env.VITE_ASGARDEX_THORNODE_API, '')
export const ASGARDEX_THORNODE_RPC = envOrDefault(import.meta.env.VITE_ASGARDEX_THORNODE_RPC, '')

/**
 * Mainnet THORNode REST bases for xchain-query / aggregator round-robin.
 * Liquify primary; Asgardex secondary when configured. Dead `thornode.thorchain.network` omitted.
 */
export const THORNODE_API_BASE_URLS = [PUBLIC_LIQUIFY_THORNODE_API, ASGARDEX_THORNODE_API].filter(Boolean)

/**
 * Authenticated Liquify RPC key from portal (path form: `/api=<KEY>`).
 * Never surface this in Expert Mode / storage — only inject at client construction.
 */
export const LIQUIFY_THORCHAIN_RPC_KEY = envOrDefault(import.meta.env.VITE_LIQUIFY_THORCHAIN_RPC_KEY, '')

/** Build authenticated Liquify RPC URL from a portal key, or empty if unset. */
export const liquifyAuthenticatedRpcUrl = (key: string): string => (key ? `https://gateway.liquify.com/api=${key}` : '')

/** True when URL is a Liquify portal authenticated path (`/api=…`). */
export const isLiquifyAuthenticatedRpcUrl = (url: string): boolean =>
  /^https:\/\/gateway\.liquify\.com\/api=/i.test(url)

/**
 * URL safe for Expert Mode UI and persistent storage.
 * Strips Liquify `/api=<KEY>` endpoints back to the public path so the key is never shown/saved.
 */
export const maskThornodeRpcUrl = (url: string): string =>
  isLiquifyAuthenticatedRpcUrl(url) ? PUBLIC_LIQUIFY_THORNODE_RPC : url

/**
 * Resolve the Tendermint RPC URL used for signing/broadcast (and ledger).
 * When `VITE_LIQUIFY_THORCHAIN_RPC_KEY` is set and the configured URL is empty or the
 * public Liquify RPC, use the authenticated portal URL. Custom Expert URLs are left alone.
 */
export const resolveThornodeRpcUrl = (configured: string): string => {
  const authenticated = liquifyAuthenticatedRpcUrl(LIQUIFY_THORCHAIN_RPC_KEY)
  if (!authenticated) return configured

  const normalized = maskThornodeRpcUrl(configured)
  if (!normalized || normalized === PUBLIC_LIQUIFY_THORNODE_RPC) {
    return authenticated
  }

  return normalized
}

/**
 * RPC URL list for xchain Client `clientUrls` (round-robin).
 * Mainnet: primary (Expert / Liquify key) then Asgardex RPC fallback when configured.
 * Other networks: primary only.
 */
export const getThornodeRpcClientUrls = (configured: string, network: Network): string[] => {
  const primary = resolveThornodeRpcUrl(configured)
  if (!primary) {
    return network === Network.Mainnet && ASGARDEX_THORNODE_RPC ? [ASGARDEX_THORNODE_RPC] : []
  }
  if (network !== Network.Mainnet) return [primary]
  if (!ASGARDEX_THORNODE_RPC || primary === ASGARDEX_THORNODE_RPC) return [primary]
  return [primary, ASGARDEX_THORNODE_RPC]
}

export const DEFAULT_THORNODE_RPC_URLS: ApiUrls = {
  // Defaults stay public; authenticated URL is applied only via resolveThornodeRpcUrl()
  mainnet: maskThornodeRpcUrl(envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_RPC, PUBLIC_LIQUIFY_THORNODE_RPC)),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_RPC, ''),
  testnet: ''
}

export const DEFAULT_THORNODE_API_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_API, PUBLIC_LIQUIFY_THORNODE_API),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_API, ''),
  testnet: envOrDefault(import.meta.env.VITE_TESTNET_THORNODE_API, 'https://testnet.thornode.thorchain.info')
}
