import { ASGARDEX_NAME } from '../../../shared/const'

export const ONECLICK_QUOTE_URL = 'https://1click.chaindefuser.com/v0/quote'

let installed = false

export const stampOneClickQuoteBody = (body: string, referral: string = ASGARDEX_NAME): string => {
  try {
    const parsed: unknown = JSON.parse(body)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return body
    return JSON.stringify({ ...(parsed as Record<string, unknown>), referral })
  } catch {
    return body
  }
}

const quoteUrlFromInput = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

const isOneClickQuoteUrl = (url: string): boolean => url.split('?')[0] === ONECLICK_QUOTE_URL

/**
 * Aggregator 3.1.0 has no referral config. Stamp `referral=asgardex` on
 * POST /v0/quote until xchain-aggregator grows a passthrough.
 */
export const installOneClickReferralStamp = (): void => {
  if (installed || typeof globalThis.fetch !== 'function') return
  installed = true
  const originalFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!isOneClickQuoteUrl(quoteUrlFromInput(input)) || typeof init?.body !== 'string') {
      return originalFetch(input, init)
    }
    return originalFetch(input, { ...init, body: stampOneClickQuoteBody(init.body) })
  }) as typeof fetch
}
