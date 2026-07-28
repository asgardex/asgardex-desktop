import { ApiUrls } from '../api/types'
import { envOrDefault } from '../utils/env'

/** Public (rate-limited) Liquify Tendermint RPC — no API key. */
export const PUBLIC_LIQUIFY_THORNODE_RPC = 'https://gateway.liquify.com/chain/thorchain_rpc'

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
 *
 * Path-style portal keys work as a normal URL string — xchain-thorchain only needs
 * `clientUrls`; no package change is required for `/api=<KEY>` auth.
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

export const DEFAULT_THORNODE_RPC_URLS: ApiUrls = {
  // Defaults stay public; authenticated URL is applied only via resolveThornodeRpcUrl()
  mainnet: maskThornodeRpcUrl(envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_RPC, PUBLIC_LIQUIFY_THORNODE_RPC)),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_RPC, ''),
  testnet: ''
}

export const DEFAULT_THORNODE_API_URLS: ApiUrls = {
  mainnet: envOrDefault(import.meta.env.VITE_MAINNET_THORNODE_API, 'https://gateway.liquify.com/chain/thorchain_api'),
  stagenet: envOrDefault(import.meta.env.VITE_STAGENET_THORNODE_API, ''),
  testnet: envOrDefault(import.meta.env.VITE_TESTNET_THORNODE_API, 'https://testnet.thornode.thorchain.info')
}
