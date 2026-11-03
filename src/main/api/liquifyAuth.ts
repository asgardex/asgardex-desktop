import type { Session } from 'electron'

/**
 * Liquify gateway authentication — main process only.
 *
 * The renderer only knows plain, keyless URLs (e.g. `https://gateway.liquify.com/chain/thorchain_api`).
 * This module adds the Liquify portal key as an `X-API-KEY` request header for requests that go to
 * exactly `https://gateway.liquify.com`, so the key never needs to be compiled into the renderer
 * bundle, shown in Expert Mode or persisted in a store file.
 *
 * Security notes:
 * - Keys come from `MAIN_VITE_LIQUIFY_*` env vars (see `liquifyKeys.ts`). Vite never exposes
 *   `MAIN_VITE_*` to the renderer / preload bundles.
 * - The key is still compiled into the *main* bundle and can be extracted from `app.asar` by a
 *   determined user. This hides it from the renderer bundle and DevTools only.
 * - Keys are never logged. Only product names (`midgard`, `thornodeApi`, ...) are.
 * - Only exact `https` + `gateway.liquify.com` (default port) is matched. Look-alike hosts, `http`,
 *   `midgard.thorchain.network` and any custom Expert Mode host never receive the key.
 * - A header the renderer already set is left untouched (never overwritten, never echoed).
 */

export const LIQUIFY_GATEWAY_HOST = 'gateway.liquify.com'
export const LIQUIFY_API_KEY_HEADER = 'X-API-KEY'

export type LiquifyProduct = 'midgard' | 'thornodeApi' | 'thornodeRpc'

export type LiquifyKeys = Record<LiquifyProduct, string>

export const EMPTY_LIQUIFY_KEYS: LiquifyKeys = { midgard: '', thornodeApi: '', thornodeRpc: '' }

/** Path prefix of the keyless "provider style" Midgard route on the gateway. */
const MIDGARD_CHAIN_PREFIX = '/chain/thorchain_midgard'

/**
 * Path prefixes -> product. Provider style (`/chain/...`) is what the app uses today.
 * Root style (`/v2/...` Midgard, `/thorchain/...` + `/cosmos/...` THORNode REST) is what the gateway
 * serves when authenticated. The root cannot tell products apart other than by path, so path decides.
 */
const PRODUCT_PREFIXES: ReadonlyArray<readonly [string, LiquifyProduct]> = [
  [MIDGARD_CHAIN_PREFIX, 'midgard'],
  ['/v2', 'midgard'],
  ['/chain/thorchain_api', 'thornodeApi'],
  ['/thorchain', 'thornodeApi'],
  ['/cosmos', 'thornodeApi'],
  ['/chain/thorchain_rpc', 'thornodeRpc']
]

const hasPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/** Only printable ASCII without whitespace: protects against header injection via a bad env value. */
const SAFE_KEY = /^[\x21-\x7e]+$/

/** Returns a trimmed key, or '' when it is unset / unsafe. */
export const sanitizeLiquifyKey = (key: string | undefined): string => {
  const trimmed = (key ?? '').trim()
  return SAFE_KEY.test(trimmed) ? trimmed : ''
}

/** Parses `url` and returns it only for `https://gateway.liquify.com` (exact host, default port). */
const parseGatewayUrl = (url: string): URL | null => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (parsed.hostname !== LIQUIFY_GATEWAY_HOST) return null
  if (parsed.port !== '') return null
  if (parsed.username !== '' || parsed.password !== '') return null
  return parsed
}

/** True only for `https://gateway.liquify.com/...` — exact host match. */
export const isLiquifyGatewayUrl = (url: string): boolean => parseGatewayUrl(url) !== null

/** Which Liquify product a gateway URL belongs to (by path), or `null` for anything else. */
export const getLiquifyProduct = (url: string): LiquifyProduct | null => {
  const parsed = parseGatewayUrl(url)
  if (!parsed) return null
  const match = PRODUCT_PREFIXES.find(([prefix]) => hasPrefix(parsed.pathname, prefix))
  return match ? match[1] : null
}

/**
 * Midgard routing when a Midgard key is configured.
 *
 * Without a key the keyless `/chain/thorchain_midgard/...` route is used (public, rate limited).
 * With a key, the authenticated gateway serves Midgard at the gateway ROOT (`/v2/...`); the
 * `/chain/thorchain_midgard/...` route answers 500 for keyed requests. Instead of teaching the
 * renderer about the key, main rewrites the path prefix on the way out. This also covers the
 * hardcoded URL lists inside the xchainjs aggregator / midgard-query.
 *
 * Returns the rewritten URL or `null` when no rewrite applies (no key, other host, other path).
 */
export const getMidgardRootUrl = (url: string, keys: LiquifyKeys): string | null => {
  if (!keys.midgard) return null
  const parsed = parseGatewayUrl(url)
  if (!parsed || !hasPrefix(parsed.pathname, MIDGARD_CHAIN_PREFIX)) return null
  const rest = parsed.pathname.slice(MIDGARD_CHAIN_PREFIX.length) || '/'
  return `https://${LIQUIFY_GATEWAY_HOST}${rest}${parsed.search}`
}

/**
 * Returns the request headers to send: a copy of `requestHeaders` plus `X-API-KEY` when
 * `url` is a Liquify gateway URL whose product has a key. Never overwrites an existing
 * `X-API-KEY` (any casing) and never mutates the input.
 */
export const withLiquifyAuthHeader = (
  url: string,
  requestHeaders: Record<string, string>,
  keys: LiquifyKeys
): Record<string, string> => {
  const product = getLiquifyProduct(url)
  if (!product) return requestHeaders
  const key = keys[product]
  if (!key) return requestHeaders
  const alreadySet = Object.keys(requestHeaders).some(
    (name) => name.toLowerCase() === LIQUIFY_API_KEY_HEADER.toLowerCase()
  )
  if (alreadySet) return requestHeaders
  return { ...requestHeaders, [LIQUIFY_API_KEY_HEADER]: key }
}

/** Normalizes raw (env) values: trims, drops anything unsafe. */
export const toLiquifyKeys = (raw: Partial<Record<LiquifyProduct, string | undefined>>): LiquifyKeys => ({
  midgard: sanitizeLiquifyKey(raw.midgard),
  thornodeApi: sanitizeLiquifyKey(raw.thornodeApi),
  thornodeRpc: sanitizeLiquifyKey(raw.thornodeRpc)
})

type Logger = { info: (...args: unknown[]) => void }

/** Subset of Electron's `WebRequest` this module uses (keeps it unit-testable). */
export type LiquifyWebRequest = Pick<Session['webRequest'], 'onBeforeRequest' | 'onBeforeSendHeaders'>

/**
 * Registers the Liquify auth hooks on a session. Does nothing (returns `[]`) when no key is set.
 *
 * NOTE: Electron allows ONE listener per event per session; a later registration replaces this one.
 *
 * @returns names of the products with a key (never the keys themselves)
 */
export const registerLiquifyAuth = (
  webRequest: LiquifyWebRequest,
  rawKeys: LiquifyKeys,
  log?: Logger
): LiquifyProduct[] => {
  const keys = toLiquifyKeys(rawKeys)
  const enabled = (Object.keys(keys) as LiquifyProduct[]).filter((product) => !!keys[product])
  if (enabled.length === 0) return []

  const filter = { urls: [`https://${LIQUIFY_GATEWAY_HOST}/*`] }

  if (keys.midgard) {
    webRequest.onBeforeRequest(filter, (details, callback) => {
      const redirectURL = getMidgardRootUrl(details.url, keys)
      callback(redirectURL ? { redirectURL } : {})
    })
  }

  webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    callback({ requestHeaders: withLiquifyAuthHeader(details.url, details.requestHeaders, keys) })
  })

  log?.info(`Liquify gateway auth header enabled for: ${enabled.join(', ')}`)
  return enabled
}
