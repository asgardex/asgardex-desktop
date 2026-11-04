import { isLiquifyGatewayUrl, LIQUIFY_API_KEY_HEADER } from './liquifyAuth'

/**
 * Safe `fetch` for the main process when a request carries the Liquify `X-API-KEY` header
 * (the Ledger RPC path: cosmjs passes `{ url, headers }` and calls the GLOBAL `fetch`).
 *
 * Node's fetch (undici) forwards custom headers such as `X-API-KEY` across cross-origin redirects
 * (only `Authorization` / `Cookie` are stripped). To make sure the key can never leave
 * `https://gateway.liquify.com`, requests that carry the header are sent with `redirect: 'manual'`
 * and redirects are followed here, re-checking the host on EVERY hop: the header is dropped as soon as
 * the target is not exactly `https://gateway.liquify.com`. Requests without the header are passed
 * through untouched.
 */
/** Copies headers (forEach: `Headers.entries()` is not in this tsconfig's lib typings). */
const copyHeaders = (headers: Headers): Headers => {
  const copy = new Headers()
  headers.forEach((value, name) => copy.append(name, value))
  return copy
}

const API_KEY_HEADER_LOWER = LIQUIFY_API_KEY_HEADER.toLowerCase()
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 5

export const createLiquifySafeFetch =
  (baseFetch: typeof fetch): typeof fetch =>
  async (input, init) => {
    const requestHeaders = new Headers(
      init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined)
    )
    if (!requestHeaders.has(API_KEY_HEADER_LOWER)) return baseFetch(input, init)

    // Exotic input (a `Request` object): don't try to re-issue it, just refuse to follow any redirect.
    if (typeof input !== 'string' && !(input instanceof URL)) {
      return baseFetch(input, { ...init, redirect: 'error' })
    }

    let url = typeof input === 'string' ? input : input.href
    let method = init?.method ?? 'GET'
    let body = init?.body
    for (let hop = 0; ; hop++) {
      // Never send the key anywhere but the gateway, not even on the first hop.
      if (!isLiquifyGatewayUrl(url)) requestHeaders.delete(API_KEY_HEADER_LOWER)
      const response = await baseFetch(url, {
        ...init,
        method,
        body,
        headers: copyHeaders(requestHeaders),
        redirect: 'manual'
      })
      const location = response.headers.get('location')
      if (!REDIRECT_STATUSES.has(response.status) || !location) return response
      if (hop >= MAX_REDIRECTS) throw new TypeError('fetch failed: too many redirects')
      void response.body?.cancel().catch(() => undefined)
      url = new URL(location, url).href
      // Same method semantics as the fetch spec: 303 (and POST on 301/302) becomes a body-less GET.
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
        method = 'GET'
        body = undefined
        requestHeaders.delete('content-type')
      }
    }
  }

let installed = false

/** Wraps the global `fetch` once. Unrelated (header-less) requests behave exactly as before. */
export const installLiquifySafeFetch = (): void => {
  if (installed) return
  installed = true
  globalThis.fetch = createLiquifySafeFetch(globalThis.fetch.bind(globalThis))
}
