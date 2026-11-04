import { Network } from '@xchainjs/xchain-client'

import { getLiquifyProduct, LIQUIFY_API_KEY_HEADER, sanitizeLiquifyKey } from '../../liquifyAuth'

/**
 * Shape of a cosmjs `HttpEndpoint` (`@cosmjs/tendermint-rpc`): `{ url, headers }`.
 * Declared locally to avoid depending on a transitive package for one type.
 */
export type RpcHttpEndpoint = { url: string; headers: Record<string, string> }

/**
 * Ledger signing runs in the Electron MAIN process using Node's global `fetch` (via cosmjs), which does
 * NOT go through `session.webRequest`, so the `liquifyAuth.ts` injector cannot add the Liquify key header.
 *
 * `@xchainjs/xchain-thorchain` types `clientUrls` as `string[]`, but only ever hands each entry
 * straight to cosmjs `StargateClient.connect(entry)` / `SigningStargateClient.connectWithSigner(entry, ...)`,
 * which accept `string | HttpEndpoint`. So for the Liquify THORNode RPC we pass
 * `{ url, headers: { 'X-API-KEY': key } }` instead of a string. The key therefore stays a header
 * (never in a URL), lives in main memory only and is never persisted, logged or sent over IPC.
 *
 * Only entries for exact `https://gateway.liquify.com` + RPC path get the header; custom URLs and the
 * Asgardex fallback are untouched. Mainnet only. Empty / unsafe key → the URLs are returned unchanged.
 *
 * The result is cast to `string[]` for the xchainjs typings; the object entries are valid at runtime.
 */
export const withLiquifyRpcHeaderKey = (urls: string[], network: Network, rawKey: string | undefined): string[] => {
  if (network !== Network.Mainnet) return urls
  const key = sanitizeLiquifyKey(rawKey)
  if (!key) return urls
  const endpoints: Array<string | RpcHttpEndpoint> = urls.map((url) =>
    getLiquifyProduct(url) === 'thornodeRpc' ? { url, headers: { [LIQUIFY_API_KEY_HEADER]: key } } : url
  )
  return endpoints as unknown as string[]
}
