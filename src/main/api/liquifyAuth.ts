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
 * - Keys come from `VITE_LIQUIFY_*` env vars (see `liquifyKeys.ts`) and are read in the main process
 *   only. Nothing in the renderer / preload references them, so they are not compiled into those bundles.
 * - The key is still compiled into the *main* bundle and can be extracted from `app.asar` by a
 *   determined user. The header is added by the network layer, so it is NOT visible to renderer JS
 *   and is not in the renderer bundle — but it is NOT hidden from DevTools / CDP (the Network panel
 *   and the DevTools protocol show `X-API-KEY`). Treat the keys as extractable: use least-privilege,
 *   rate-limited keys and ROTATE them — older releases carry the previous `VITE_LIQUIFY_*` keys in
 *   their renderer bundles.
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

/** Path prefix of the keyless "provider style" THORNode REST route on the gateway. */
const THORNODE_API_CHAIN_PREFIX = '/chain/thorchain_api'

/** Path prefix of the keyless "provider style" THORNode Tendermint RPC route on the gateway. */
const THORNODE_RPC_CHAIN_PREFIX = '/chain/thorchain_rpc'

/**
 * Path prefixes -> product. Provider style (`/chain/...`) is what the app uses today.
 * Root style (`/v2/...` Midgard, `/thorchain/...` + `/cosmos/...` THORNode REST) is what the gateway
 * serves when authenticated. The root cannot tell products apart other than by path, so path decides.
 */
const PRODUCT_PREFIXES: ReadonlyArray<readonly [string, LiquifyProduct]> = [
  [MIDGARD_CHAIN_PREFIX, 'midgard'],
  ['/v2', 'midgard'],
  [THORNODE_API_CHAIN_PREFIX, 'thornodeApi'],
  ['/thorchain', 'thornodeApi'],
  ['/cosmos', 'thornodeApi'],
  [THORNODE_RPC_CHAIN_PREFIX, 'thornodeRpc'],
  // Keyed JSON-RPC is rewritten off `/chain/thorchain_rpc` onto the gateway root.
  // Exact `/` only (`hasPrefix` does not treat `/` as a prefix of every path), so the
  // follow-up request still receives the RPC key. `/health` stays untagged: the gateway answers that itself.
  ['/', 'thornodeRpc']
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
 * Rewrites a keyed provider-style gateway URL (`https://gateway.liquify.com<prefix>/<rest>`) to the gateway
 * ROOT (`https://gateway.liquify.com/<rest>`), keeping the query. Used for Midgard (`/chain/thorchain_midgard`)
 * and THORNode REST (`/chain/thorchain_api`): with an `X-API-KEY` the gateway routes by key and does NOT strip
 * the `/chain/...` prefix, so keyed requests must use the root form.
 *
 * `allowedRest`, when given, limits the rewrite to `<rest>` paths starting with one of those prefixes.
 *
 * Returns the rewritten URL or `null` when no rewrite applies (other host, other path, `<rest>` not allowed).
 * The result is always an exact `https://gateway.liquify.com` URL.
 */
const toGatewayRootUrl = (url: string, prefix: string, allowedRest?: ReadonlyArray<string>): string | null => {
  const parsed = parseGatewayUrl(url)
  if (!parsed || !hasPrefix(parsed.pathname, prefix)) return null
  const rest = parsed.pathname.slice(prefix.length) || '/'
  if (allowedRest && !allowedRest.some((allowed) => rest.startsWith(allowed))) return null
  const rewritten = `https://${LIQUIFY_GATEWAY_HOST}${rest}${parsed.search}`
  // Defensive: the rewrite must never leave the gateway (host + scheme), whatever the path / query looks like.
  return isLiquifyGatewayUrl(rewritten) ? rewritten : null
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
export const getMidgardRootUrl = (url: string, keys: LiquifyKeys): string | null =>
  keys.midgard ? toGatewayRootUrl(url, MIDGARD_CHAIN_PREFIX) : null

/** THORNode REST paths (below `/chain/thorchain_api`) that are rewritten to the gateway root. */
const THORNODE_API_ROOT_PATHS = ['/thorchain/', '/cosmos/'] as const

/**
 * Same as Midgard for THORNode REST: with a key the gateway does NOT strip `/chain/thorchain_api`, so the node
 * receives `/chain/thorchain_api/thorchain/...` and grpc-gateway answers 501 `{"code":12,"message":"Not Implemented"}`.
 * Keyed THORNode REST must use the gateway root (`/thorchain/...`, `/cosmos/...`), like the old `/api=<KEY>/...` URLs.
 * Only `/thorchain/...` and `/cosmos/...` are rewritten (they map back to the THORNode API key at the root);
 * anything else (e.g. `/chain/thorchain_api/v2/...`) is left alone so it cannot land on another product's root path.
 */
export const getThornodeApiRootUrl = (url: string, keys: LiquifyKeys): string | null =>
  keys.thornodeApi ? toGatewayRootUrl(url, THORNODE_API_CHAIN_PREFIX, THORNODE_API_ROOT_PATHS) : null

/**
 * THORNode RPC with a key. The provider path `/chain/thorchain_rpc` answers 404 once `X-API-KEY` is set;
 * the gateway routes that key at the root (`POST /` for JSON-RPC, `/status`, …). Keyless calls keep the
 * provider path, which is the public route.
 */
export const getThornodeRpcRootUrl = (url: string, keys: LiquifyKeys): string | null =>
  keys.thornodeRpc ? toGatewayRootUrl(url, THORNODE_RPC_CHAIN_PREFIX) : null

/**
 * Root rewrite for any keyed provider-style route, or `null`.
 *
 * RPC included: a keyed `/chain/thorchain_rpc` request is 404. After the rewrite the request is
 * `POST https://gateway.liquify.com/`, and `getLiquifyProduct` still tags that exact path as `thornodeRpc`
 * so the RPC key is attached. `/health` is not tagged; the gateway answers it itself.
 */
export const getLiquifyRootUrl = (url: string, keys: LiquifyKeys): string | null =>
  getMidgardRootUrl(url, keys) ?? getThornodeApiRootUrl(url, keys) ?? getThornodeRpcRootUrl(url, keys)

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

  if (keys.midgard || keys.thornodeApi || keys.thornodeRpc) {
    webRequest.onBeforeRequest(filter, (details, callback) => {
      const redirectURL = getLiquifyRootUrl(details.url, keys)
      callback(redirectURL ? { redirectURL } : {})
    })
  }

  webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    callback({ requestHeaders: withLiquifyAuthHeader(details.url, details.requestHeaders, keys) })
  })

  log?.info(`Liquify gateway auth header enabled for: ${enabled.join(', ')}`)
  return enabled
}
