import { HttpClient } from '@cosmjs/tendermint-rpc'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLiquifySafeFetch } from './liquifySafeFetch'

// Fake value only — never a real key.
const FAKE = 'fake-rpc-key'
const GW = 'https://gateway.liquify.com'

const redirect = (status: number, location: string) => new Response(null, { status, headers: { location } })
const ok = () =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

/** Headers of the n-th call, as a plain lowercase object. */
const headersOf = (mock: ReturnType<typeof vi.fn>, n: number): Record<string, string> => {
  const result: Record<string, string> = {}
  ;(mock.mock.calls[n][1].headers as Headers).forEach((value, name) => {
    result[name.toLowerCase()] = value
  })
  return result
}

describe('main/api/liquifySafeFetch', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('passes requests without X-API-KEY straight through (same arguments, redirects untouched)', async () => {
    const base = vi.fn().mockResolvedValue(ok())
    const safe = createLiquifySafeFetch(base as unknown as typeof fetch)
    const init = { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }
    await safe('https://example.org/x', init)
    expect(base).toHaveBeenCalledTimes(1)
    expect(base.mock.calls[0]).toEqual(['https://example.org/x', init])
    expect(base.mock.calls[0][1].redirect).toBeUndefined()
  })

  it('sends keyed requests with redirect: manual and the header on the gateway', async () => {
    const base = vi.fn().mockResolvedValue(ok())
    await createLiquifySafeFetch(base as unknown as typeof fetch)(`${GW}/chain/thorchain_rpc`, {
      headers: { 'X-API-KEY': FAKE }
    })
    expect(base.mock.calls[0][1].redirect).toBe('manual')
    expect(headersOf(base, 0)['x-api-key']).toBe(FAKE)
  })

  it('drops X-API-KEY when redirected off the gateway, and never sends it to the other host', async () => {
    const base = vi.fn().mockResolvedValueOnce(redirect(302, 'https://evil.example/steal')).mockResolvedValueOnce(ok())
    const res = await createLiquifySafeFetch(base as unknown as typeof fetch)(`${GW}/chain/thorchain_rpc`, {
      headers: { 'X-API-KEY': FAKE, 'content-type': 'application/json' },
      method: 'POST',
      body: '{}'
    })
    expect(res.status).toBe(200)
    expect(base).toHaveBeenCalledTimes(2)
    expect(String(base.mock.calls[1][0])).toBe('https://evil.example/steal')
    expect(headersOf(base, 1)['x-api-key']).toBeUndefined()
    // no later hop gets it back either
    expect(JSON.stringify(base.mock.calls.slice(1))).not.toContain(FAKE)
  })

  it.each([
    'https://gateway.liquify.com.evil.io/x',
    'http://gateway.liquify.com/x',
    'https://gateway.liquify.com:8443/x',
    'https://midgard.thorchain.network/x'
  ])('drops the header for look-alike / non-https / other redirect target %s', async (target) => {
    const base = vi.fn().mockResolvedValueOnce(redirect(307, target)).mockResolvedValueOnce(ok())
    await createLiquifySafeFetch(base as unknown as typeof fetch)(`${GW}/v`, { headers: { 'X-API-KEY': FAKE } })
    expect(headersOf(base, 1)['x-api-key']).toBeUndefined()
  })

  it('keeps the header on same-gateway redirects (relative and absolute) and drops it if it later leaves', async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(redirect(308, '/chain/thorchain_rpc/'))
      .mockResolvedValueOnce(redirect(301, `${GW}/other`))
      .mockResolvedValueOnce(redirect(302, 'https://evil.example/'))
      .mockResolvedValueOnce(ok())
    await createLiquifySafeFetch(base as unknown as typeof fetch)(`${GW}/chain/thorchain_rpc`, {
      headers: { 'X-API-KEY': FAKE }
    })
    expect(String(base.mock.calls[1][0])).toBe(`${GW}/chain/thorchain_rpc/`)
    expect(headersOf(base, 1)['x-api-key']).toBe(FAKE)
    expect(headersOf(base, 2)['x-api-key']).toBe(FAKE)
    expect(headersOf(base, 3)['x-api-key']).toBeUndefined()
  })

  it('turns POST into a body-less GET on 303', async () => {
    const base = vi.fn().mockResolvedValueOnce(redirect(303, '/next')).mockResolvedValueOnce(ok())
    await createLiquifySafeFetch(base as unknown as typeof fetch)(`${GW}/x`, {
      method: 'POST',
      body: '{}',
      headers: { 'X-API-KEY': FAKE, 'content-type': 'application/json' }
    })
    expect(base.mock.calls[1][1].method).toBe('GET')
    expect(base.mock.calls[1][1].body).toBeUndefined()
  })

  it('gives up after too many redirects (never loops forever)', async () => {
    const base = vi.fn().mockImplementation(async () => redirect(302, `${GW}/loop`))
    await expect(
      createLiquifySafeFetch(base as unknown as typeof fetch)(`${GW}/loop`, { headers: { 'X-API-KEY': FAKE } })
    ).rejects.toThrow(/too many redirects/)
    expect(base.mock.calls.length).toBeLessThanOrEqual(6)
  })

  it('refuses to follow redirects for exotic Request input', async () => {
    const base = vi.fn().mockResolvedValue(ok())
    await createLiquifySafeFetch(base as unknown as typeof fetch)(
      new Request(`${GW}/x`, { headers: { 'X-API-KEY': FAKE } })
    )
    expect(base.mock.calls[0][1].redirect).toBe('error')
  })

  it('works end-to-end with the cosmjs HttpClient used by the Ledger client', async () => {
    const base = vi.fn().mockResolvedValueOnce(redirect(302, 'https://evil.example/rpc')).mockResolvedValueOnce(ok())
    vi.stubGlobal('fetch', createLiquifySafeFetch(base as unknown as typeof fetch))
    const client = new HttpClient({ url: `${GW}/chain/thorchain_rpc`, headers: { 'X-API-KEY': FAKE } })
    await client.execute({ jsonrpc: '2.0', id: 1, method: 'health', params: {} })
    expect(headersOf(base, 0)['x-api-key']).toBe(FAKE)
    expect(String(base.mock.calls[1][0])).toBe('https://evil.example/rpc')
    expect(headersOf(base, 1)['x-api-key']).toBeUndefined()
  })
})
