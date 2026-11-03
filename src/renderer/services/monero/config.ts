import { Network } from '@xchainjs/xchain-client'
import { defaultXMRParams, XMRClientParams } from '@xchainjs/xchain-monero'
import { option as O } from 'fp-ts'

import { observableState } from '../../helpers/stateHelper'

/**
 * Connection settings for the (watch-only) Monero client.
 *
 * Privacy defaults
 * ----------------
 * - `lwsUrl` is empty by default: **no light-wallet server**. A Monero LWS needs the private
 *   *view key*, which lets the server see every incoming payment of the wallet. By default the view key
 *   never leaves the device — the client scans blocks of a public daemon locally instead.
 * - A custom LWS / daemon is opt-in (Wallet settings → Monero) and must be reachable via `https://`
 *   (plain `http://` is only accepted for localhost / private-network nodes).
 */
export type XmrConnectionConfig = {
  /** Monero daemon (`monerod`) RPC endpoint. Empty = use defaults of `@xchainjs/xchain-monero`. */
  daemonUrl: string
  /** MyMonero-compatible light-wallet server. Empty = disabled (view key stays local). */
  lwsUrl: string
  /** Block height to start scanning from. `null` = auto (height at first use of an address, see `resolveRestoreHeight`). */
  restoreHeight: number | null
}

export const DEFAULT_XMR_CONNECTION_CONFIG: XmrConnectionConfig = {
  daemonUrl: '',
  lwsUrl: '',
  restoreHeight: null
}

export const XMR_CONNECTION_STORAGE_KEY = 'asgardex-xmr-connection'
export const XMR_BIRTH_HEIGHT_STORAGE_KEY = 'asgardex-xmr-birth-height'

/**
 * Blocks to step back from the tip when an address is used for the first time.
 * ~720 blocks ≈ 1 day (2 min / block) — covers clock skew / reorgs without exceeding the SDK's 5,000 block scan limit.
 */
export const XMR_BIRTH_HEIGHT_MARGIN = 720

/** Minimal `Storage` subset (`window.localStorage` compatible) */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

const LOCAL_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/

/**
 * Validates a user supplied node endpoint.
 * Accepts `https://` URLs, and `http://` only for localhost / private-network hosts.
 * Rejects credentials in the URL, query strings and fragments.
 */
export const isValidXmrEndpoint = (value: string): boolean => {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash) return false
    if (url.protocol === 'https:') return true
    return url.protocol === 'http:' && LOCAL_HOST.test(url.hostname)
  } catch {
    return false
  }
}

/** Removes trailing slashes (the SDK appends paths like `/json_rpc`) */
export const normalizeXmrEndpoint = (value: string): string => value.trim().replace(/\/+$/, '')

const isHeight = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/**
 * Sanitizes (possibly corrupted / tampered) persisted config. Invalid values fall back to the defaults.
 */
export const sanitizeXmrConnectionConfig = (raw: unknown): XmrConnectionConfig => {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const endpoint = (v: unknown): string => {
    if (typeof v !== 'string') return ''
    const normalized = normalizeXmrEndpoint(v)
    return normalized !== '' && isValidXmrEndpoint(normalized) ? normalized : ''
  }
  return {
    daemonUrl: endpoint(input.daemonUrl),
    lwsUrl: endpoint(input.lwsUrl),
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

/** Persists + publishes new connection settings. The Monero client is re-created afterwards. */
const updateXmrConnectionConfig = (config: XmrConnectionConfig): void => {
  const sanitized = sanitizeXmrConnectionConfig(config)
  saveXmrConnectionConfig(sanitized)
  setXmrConnectionConfigState(sanitized)
}

export { xmrConnectionConfig$, updateXmrConnectionConfig }

/**
 * Maps settings to `@xchainjs/xchain-monero` client params.
 *
 * - `walletRpcUrls` are **never** set: in-app sending is not supported (watch-only).
 * - Without a custom `lwsUrl` the LWS list stays empty -> the view key is never sent to a remote server.
 */
export const buildXmrClientParams = ({
  config,
  network,
  restoreHeight
}: {
  config: XmrConnectionConfig
  network: Network
  restoreHeight: number
}): Pick<XMRClientParams, 'daemonUrls' | 'lwsUrls' | 'walletRpcUrls' | 'restoreHeight'> => {
  const daemonUrls = {
    ...(defaultXMRParams.daemonUrls as Record<Network, string[]>),
    ...(config.daemonUrl ? { [network]: [config.daemonUrl] } : {})
  } as Record<Network, string[]>
  const lwsUrls = {
    [Network.Mainnet]: [],
    [Network.Stagenet]: [],
    [Network.Testnet]: [],
    ...(config.lwsUrl ? { [network]: [config.lwsUrl] } : {})
  } as Record<Network, string[]>
  const walletRpcUrls = {
    [Network.Mainnet]: [],
    [Network.Stagenet]: [],
    [Network.Testnet]: []
  } as Record<Network, string[]>
  return { daemonUrls, lwsUrls, walletRpcUrls, restoreHeight }
}

/** Daemon endpoint used to look up the chain height */
export const getDaemonUrl = (config: XmrConnectionConfig, network: Network): string | undefined =>
  config.daemonUrl || (defaultXMRParams.daemonUrls as Record<Network, string[]>)[network]?.[0]

type FetchLike = (
  input: string,
  init?: { method: string; headers: Record<string, string>; body: string }
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
    body: JSON.stringify({ jsonrpc: '2.0', id: '0', method: 'get_block_count' })
  })
  if (!response.ok) throw new Error('Could not get Monero daemon height')
  const json = (await response.json()) as { result?: { count?: unknown } }
  const count = json?.result?.count
  if (!isHeight(count)) throw new Error('Invalid Monero daemon height')
  return count
}

const birthHeightKey = (network: Network, address: string) => `${XMR_BIRTH_HEIGHT_STORAGE_KEY}:${network}:${address}`

/**
 * Resolves the height to start scanning from:
 * 1. explicit `restoreHeight` of settings
 * 2. height remembered for this address (first use)
 * 3. current daemon height minus a small margin — stored for next time
 *
 * Addresses derived by the client have never been used outside of it, so starting at the first-use height is safe
 * for fresh wallets. For wallets that already received funds earlier, set the restore height in the settings.
 */
export const resolveRestoreHeight = async ({
  config,
  network,
  address,
  storage = getStorage(),
  fetchHeight = fetchDaemonHeight
}: {
  config: XmrConnectionConfig
  network: Network
  address: string
  storage?: KeyValueStorage
  fetchHeight?: (daemonUrl: string) => Promise<number>
}): Promise<O.Option<number>> => {
  if (config.restoreHeight !== null) return O.some(config.restoreHeight)

  const key = birthHeightKey(network, address)
  const stored = storage?.getItem(key)
  if (stored != null) {
    const parsed = Number(stored)
    if (isHeight(parsed)) return O.some(parsed)
  }

  const daemonUrl = getDaemonUrl(config, network)
  if (!daemonUrl) return O.none
  try {
    const tip = await fetchHeight(daemonUrl)
    const height = Math.max(0, tip - XMR_BIRTH_HEIGHT_MARGIN)
    try {
      storage?.setItem(key, String(height))
    } catch {
      // ignore
    }
    return O.some(height)
  } catch {
    return O.none
  }
}
