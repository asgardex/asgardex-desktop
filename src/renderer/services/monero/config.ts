import { Network } from '@xchainjs/xchain-client'
import { defaultXMRParams } from '@xchainjs/xchain-monero'

import { observableState } from '../../helpers/stateHelper'
import { LwsConfirmation } from './lwsConfirmation'

/**
 * Connection settings for the (watch-only) Monero wallet.
 *
 * Privacy defaults
 * ----------------
 * - `lwsUrl` is empty by default: **no light-wallet server**. A Monero LWS needs the private *view key*, which lets
 *   the server see every incoming payment (and amount) of the wallet; registration is permanent. By default the view
 *   key never leaves the device — blocks of a public daemon are scanned locally instead.
 * - An LWS is opt-in AND needs an in-app confirmation bound to the exact URL (`lwsConfirmation`, see
 *   `lwsConfirmation.ts`). A URL without a valid confirmation is never contacted.
 * - Custom endpoints must be `https://`. Plain `http://` is accepted for loopback hosts only
 *   (`localhost`, `127.0.0.0/8`, `::1`) — never for LAN ranges.
 */
export type XmrConnectionConfig = {
  /** Monero daemon (`monerod`) RPC endpoint. Empty = use defaults of `@xchainjs/xchain-monero`. */
  daemonUrl: string
  /** MyMonero-compatible light-wallet server. Empty = disabled (view key stays local). */
  lwsUrl: string
  /** Proof that the user confirmed exactly `lwsUrl` in the app. `null` = not confirmed -> LWS is not used. */
  lwsConfirmation: LwsConfirmation | null
  /** Block height to start scanning from. `null` = auto (height at first use of an address, see `scanner.ts`). */
  restoreHeight: number | null
}

export const DEFAULT_XMR_CONNECTION_CONFIG: XmrConnectionConfig = {
  daemonUrl: '',
  lwsUrl: '',
  lwsConfirmation: null,
  restoreHeight: null
}

export const XMR_CONNECTION_STORAGE_KEY = 'asgardex-xmr-connection'

/** Minimal `Storage` subset (`window.localStorage` compatible) */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

/** `localhost`, `127.0.0.0/8` or `::1`. Expects a hostname as normalized by the WHATWG `URL` parser. */
const isLoopbackHostname = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)

/** Backslash, whitespace (incl. unicode spaces) or control characters anywhere in the raw input */
// eslint-disable-next-line no-control-regex -- control characters are exactly what is rejected here
const hasForbiddenEndpointChars = (value: string): boolean => /[\\\s\u0000-\u001f\u007f]/.test(value)

/**
 * Validates a user supplied node endpoint.
 * Accepts `https://` URLs, and `http://` for loopback hosts only.
 * Rejects credentials in the URL, query strings and fragments, and any backslash, whitespace or control character in
 * the raw input (`http://127.0.0.1:80\@evil.com`: browsers treat `\` like `/`, other parsers do not, so the host would
 * be read differently by different components).
 *
 * The check is done on the host *as parsed by `URL`* (so `localhost.evil.com`, `localhost@evil.com`,
 * `localhost%2eevil.com`, `127.0.0.1.evil.com` etc. are not mistaken for loopback).
 */
export const isValidXmrEndpoint = (value: string): boolean => {
  if (hasForbiddenEndpointChars(value)) return false
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash) return false
    if (url.protocol === 'https:') return url.hostname !== ''
    return url.protocol === 'http:' && isLoopbackHostname(url.hostname)
  } catch {
    return false
  }
}

/**
 * Canonical form of an endpoint: surrounding whitespace removed, then `new URL(x).href` without trailing slashes (the
 * SDK appends paths like `/json_rpc`). What is validated, stored, confirmed (LWS) and contacted is always this exact
 * string. Input which does not parse (or contains a backslash / inner whitespace) is returned trimmed, so that
 * `isValidXmrEndpoint` rejects it.
 */
export const normalizeXmrEndpoint = (value: string): string => {
  const trimmed = value.trim()
  if (hasForbiddenEndpointChars(trimmed)) return trimmed
  try {
    return new URL(trimmed).href.replace(/\/+$/, '')
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

/**
 * Safe-to-log form of an endpoint: `scheme://host[:port]` only. The path of an LWS URL can be a secret/token and
 * must never be logged or shown in error messages.
 */
export const redactXmrEndpoint = (value: string): string => {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  } catch {
    return '<invalid url>'
  }
}

const isHeight = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/**
 * Sanitizes (possibly corrupted / tampered) persisted config. Invalid values fall back to the defaults.
 * A stored confirmation is only kept if it is for exactly the stored `lwsUrl` (the MAC itself is verified later,
 * with the wallet's keys, by `getConfirmedLws`).
 */
export const sanitizeXmrConnectionConfig = (raw: unknown): XmrConnectionConfig => {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const endpoint = (v: unknown): string => {
    if (typeof v !== 'string') return ''
    const normalized = normalizeXmrEndpoint(v)
    return normalized !== '' && isValidXmrEndpoint(normalized) ? normalized : ''
  }
  const lwsUrl = endpoint(input.lwsUrl)
  const conf = (
    typeof input.lwsConfirmation === 'object' && input.lwsConfirmation !== null ? input.lwsConfirmation : {}
  ) as Record<string, unknown>
  const lwsConfirmation: LwsConfirmation | null =
    lwsUrl !== '' && conf.url === lwsUrl && typeof conf.tag === 'string' && /^[0-9a-f]{64}$/.test(conf.tag)
      ? { url: lwsUrl, tag: conf.tag }
      : null
  return {
    daemonUrl: endpoint(input.daemonUrl),
    lwsUrl,
    lwsConfirmation,
    restoreHeight: isHeight(input.restoreHeight) ? input.restoreHeight : null
  }
}

export const loadXmrConnectionConfig = (storage: KeyValueStorage | undefined = getStorage()): XmrConnectionConfig => {
  if (!storage) return DEFAULT_XMR_CONNECTION_CONFIG
  try {
    const stored = storage.getItem(XMR_CONNECTION_STORAGE_KEY)
    return stored ? sanitizeXmrConnectionConfig(JSON.parse(stored)) : DEFAULT_XMR_CONNECTION_CONFIG
  } catch {
    return DEFAULT_XMR_CONNECTION_CONFIG
  }
}

export const saveXmrConnectionConfig = (
  config: XmrConnectionConfig,
  storage: KeyValueStorage | undefined = getStorage()
): void => {
  try {
    storage?.setItem(XMR_CONNECTION_STORAGE_KEY, JSON.stringify(sanitizeXmrConnectionConfig(config)))
  } catch {
    // ignore (storage full / unavailable) — settings stay in memory for this session
  }
}

function getStorage(): KeyValueStorage | undefined {
  return typeof window !== 'undefined' ? window.localStorage : undefined
}

const { get$: xmrConnectionConfig$, set: setXmrConnectionConfigState } =
  observableState<XmrConnectionConfig>(loadXmrConnectionConfig())

/**
 * Persists + publishes new connection settings. The Monero client is re-created afterwards.
 * A changed `lwsUrl` always drops the previous confirmation unless the given config carries one for the new URL
 * (which only the confirmation flow creates).
 */
const updateXmrConnectionConfig = (config: XmrConnectionConfig): void => {
  const sanitized = sanitizeXmrConnectionConfig(config)
  saveXmrConnectionConfig(sanitized)
  setXmrConnectionConfigState(sanitized)
}

export { xmrConnectionConfig$, updateXmrConnectionConfig }

/** Daemon endpoint used for scanning / height lookups */
export const getDaemonUrl = (config: XmrConnectionConfig, network: Network): string | undefined =>
  config.daemonUrl || (defaultXMRParams.daemonUrls as Record<Network, string[]>)[network]?.[0]

type FetchLike = (
  input: string,
  init?: { method: string; headers: Record<string, string>; body: string; redirect: 'error' }
) => Promise<{
  ok: boolean
  json: () => Promise<unknown>
}>

/** Chain height (block count) of a daemon via `get_block_count` */
export const fetchDaemonHeight = async (
  daemonUrl: string,
  fetchFn: FetchLike = fetch as FetchLike
): Promise<number> => {
  const response = await fetchFn(`${daemonUrl}/json_rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '0', method: 'get_block_count' }),
    redirect: 'error'
  })
  if (!response.ok) throw new Error('Could not get Monero daemon height')
  const json = (await response.json()) as { result?: { count?: unknown } }
  const count = json?.result?.count
  if (!isHeight(count)) throw new Error('Invalid Monero daemon height')
  return count
}
