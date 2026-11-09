import { describe, expect, it, vi } from 'vitest'

import {
  getLiquifyProduct,
  getMidgardRootUrl,
  getThornodeApiRootUrl,
  isLiquifyGatewayUrl,
  LiquifyKeys,
  LiquifyWebRequest,
  registerLiquifyAuth,
  sanitizeLiquifyKey,
  withLiquifyAuthHeader
} from './liquifyAuth'

// Fake values only — never real keys.
const KEYS: LiquifyKeys = { midgard: 'fake-midgard-key', thornodeApi: 'fake-api-key', thornodeRpc: 'fake-rpc-key' }
const NO_KEYS: LiquifyKeys = { midgard: '', thornodeApi: '', thornodeRpc: '' }

const GW = 'https://gateway.liquify.com'

describe('main/api/liquifyAuth', () => {
  describe('host matching', () => {
    it('matches exact https gateway host only', () => {
      expect(isLiquifyGatewayUrl(`${GW}/chain/thorchain_api/thorchain/lastblock`)).toBe(true)
      expect(isLiquifyGatewayUrl(`${GW}`)).toBe(true)
    })
    it.each([
      'https://gateway.liquify.com.evil.io/chain/thorchain_api',
      'https://evilgateway.liquify.com/chain/thorchain_api',
      'https://gateway-liquify.com/chain/thorchain_api',
      'https://sub.gateway.liquify.com/chain/thorchain_api',
      'https://evil.io/gateway.liquify.com/chain/thorchain_api',
      'https://evil.io/?u=gateway.liquify.com',
      'https://gateway.liquify.com@evil.io/chain/thorchain_api',
      'https://user:pw@gateway.liquify.com/chain/thorchain_api',
      'https://gateway.liquify.com:8443/chain/thorchain_api',
      'http://gateway.liquify.com/chain/thorchain_api',
      'wss://gateway.liquify.com/chain/thorchain_api',
      'https://midgard.thorchain.network/v2/pools',
      'https://midgard-maya.liquify.com/v2/pools',
      'not a url',
      ''
    ])('rejects %s', (url) => {
      expect(isLiquifyGatewayUrl(url)).toBe(false)
      expect(getLiquifyProduct(url)).toBeNull()
    })
  })

  describe('product by path', () => {
    it.each([
      [`${GW}/chain/thorchain_midgard/v2/pools`, 'midgard'],
      [`${GW}/chain/thorchain_midgard`, 'midgard'],
      [`${GW}/v2/pools`, 'midgard'],
      [`${GW}/chain/thorchain_api/thorchain/lastblock`, 'thornodeApi'],
      [`${GW}/thorchain/lastblock`, 'thornodeApi'],
      [`${GW}/cosmos/bank/v1beta1/balances/thor1abc`, 'thornodeApi'],
      [`${GW}/chain/thorchain_rpc/health`, 'thornodeRpc'],
      [`${GW}/chain/thorchain_rpc`, 'thornodeRpc']
    ])('%s -> %s', (url, product) => {
      expect(getLiquifyProduct(url)).toBe(product)
    })
    it.each([`${GW}/`, `${GW}/health`, `${GW}/chain/other`, `${GW}/chain/thorchain_midgardx/v2`, `${GW}/v2x/pools`])(
      'no product for %s',
      (url) => {
        expect(getLiquifyProduct(url)).toBeNull()
      }
    )
  })

  describe('withLiquifyAuthHeader', () => {
    it('adds the key matching the product', () => {
      expect(withLiquifyAuthHeader(`${GW}/chain/thorchain_midgard/v2/pools`, { Accept: 'x' }, KEYS)).toEqual({
        Accept: 'x',
        'X-API-KEY': KEYS.midgard
      })
      expect(withLiquifyAuthHeader(`${GW}/chain/thorchain_api/thorchain/mimir`, {}, KEYS)['X-API-KEY']).toBe(
        KEYS.thornodeApi
      )
      expect(withLiquifyAuthHeader(`${GW}/chain/thorchain_rpc/health`, {}, KEYS)['X-API-KEY']).toBe(KEYS.thornodeRpc)
      expect(withLiquifyAuthHeader(`${GW}/v2/health`, {}, KEYS)['X-API-KEY']).toBe(KEYS.midgard)
    })

    it('adds nothing when the key is empty', () => {
      const headers = { Accept: 'x' }
      expect(withLiquifyAuthHeader(`${GW}/chain/thorchain_midgard/v2/pools`, headers, NO_KEYS)).toBe(headers)
      // only the product's own key is considered
      const onlyApi: LiquifyKeys = { ...NO_KEYS, thornodeApi: 'fake-api-key' }
      expect(withLiquifyAuthHeader(`${GW}/chain/thorchain_midgard/v2/pools`, headers, onlyApi)).toBe(headers)
      expect(withLiquifyAuthHeader(`${GW}/chain/thorchain_rpc/health`, headers, onlyApi)).toBe(headers)
    })

    it('adds nothing for look-alike hosts, http and midgard.thorchain.network', () => {
      for (const url of [
        'https://gateway.liquify.com.evil.io/chain/thorchain_midgard/v2/pools',
        'http://gateway.liquify.com/chain/thorchain_midgard/v2/pools',
        'https://midgard.thorchain.network/v2/pools',
        'https://gateway.liquify.com@evil.io/v2/pools'
      ]) {
        const headers = { Accept: 'x' }
        expect(withLiquifyAuthHeader(url, headers, KEYS)).toBe(headers)
      }
    })

    it('adds nothing for unrelated gateway paths', () => {
      const headers = {}
      expect(withLiquifyAuthHeader(`${GW}/health`, headers, KEYS)).toBe(headers)
    })

    it('never overwrites a header the renderer set (any casing) and does not mutate input', () => {
      for (const name of ['X-API-KEY', 'x-api-key', 'X-Api-Key']) {
        const headers = { [name]: 'renderer-value' }
        const result = withLiquifyAuthHeader(`${GW}/chain/thorchain_midgard/v2/pools`, headers, KEYS)
        expect(result).toBe(headers)
        expect(result[name]).toBe('renderer-value')
        expect(JSON.stringify(result)).not.toContain(KEYS.midgard)
      }
      const input = { Accept: 'x' }
      withLiquifyAuthHeader(`${GW}/chain/thorchain_midgard/v2/pools`, input, KEYS)
      expect(input).toEqual({ Accept: 'x' })
    })
  })

  describe('midgard root routing', () => {
    it('rewrites /chain/thorchain_midgard to the gateway root when a Midgard key is set', () => {
      expect(getMidgardRootUrl(`${GW}/chain/thorchain_midgard/v2/pools?period=30d`, KEYS)).toBe(
        `${GW}/v2/pools?period=30d`
      )
      expect(getMidgardRootUrl(`${GW}/chain/thorchain_midgard/v2/health`, KEYS)).toBe(`${GW}/v2/health`)
      expect(getMidgardRootUrl(`${GW}/chain/thorchain_midgard`, KEYS)).toBe(`${GW}/`)
    })
    it('keeps the keyless /chain route when no Midgard key is set', () => {
      expect(getMidgardRootUrl(`${GW}/chain/thorchain_midgard/v2/pools`, NO_KEYS)).toBeNull()
      expect(getMidgardRootUrl(`${GW}/chain/thorchain_midgard/v2/pools`, { ...KEYS, midgard: '' })).toBeNull()
    })
    it('never leaves https://gateway.liquify.com, whatever the path or query looks like', () => {
      const nasty = [
        '/chain/thorchain_midgard//evil.com/v2/pools',
        '/chain/thorchain_midgard/@evil.com/v2/pools',
        '/chain/thorchain_midgard/\\evil.com/v2/pools',
        '/chain/thorchain_midgard/../../evil.com',
        '/chain/thorchain_midgard/%2e%2e/%2e%2e/evil.com',
        '/chain/thorchain_midgard/v2/pools?next=https://evil.com&u=//evil.com',
        '/chain/thorchain_midgard/v2/pools?a=@evil.com#@evil.com',
        '/chain/thorchain_midgard/https://evil.com/x',
        '/chain/thorchain_midgard/:443/x',
        '/chain/thorchain_midgard',
        '/chain/thorchain_midgard/'
      ]
      for (const path of nasty) {
        const rewritten = getMidgardRootUrl(`${GW}${path}`, KEYS)
        if (rewritten === null) continue
        const url = new URL(rewritten)
        expect(url.protocol).toBe('https:')
        expect(url.hostname).toBe('gateway.liquify.com')
        expect(url.port).toBe('')
        expect(url.username + url.password).toBe('')
        expect(isLiquifyGatewayUrl(rewritten)).toBe(true)
      }
      // and URLs that are not on the gateway are never produced from other hosts
      expect(getMidgardRootUrl('https://evil.com/chain/thorchain_midgard/v2/pools', KEYS)).toBeNull()
      expect(getMidgardRootUrl('https://evil.com/?x=gateway.liquify.com/chain/thorchain_midgard/v2', KEYS)).toBeNull()
    })
    it('does not rewrite other products, hosts or schemes', () => {
      expect(getMidgardRootUrl(`${GW}/chain/thorchain_api/thorchain/lastblock`, KEYS)).toBeNull()
      expect(getMidgardRootUrl(`${GW}/chain/thorchain_rpc/health`, KEYS)).toBeNull()
      expect(getMidgardRootUrl(`${GW}/v2/pools`, KEYS)).toBeNull()
      expect(getMidgardRootUrl('https://midgard.thorchain.network/v2/pools', KEYS)).toBeNull()
      expect(getMidgardRootUrl('https://gateway.liquify.com.evil.io/chain/thorchain_midgard/v2/pools', KEYS)).toBeNull()
      expect(getMidgardRootUrl('http://gateway.liquify.com/chain/thorchain_midgard/v2/pools', KEYS)).toBeNull()
    })
  })

  describe('sanitizeLiquifyKey', () => {
    it('trims, and drops empty / unsafe values', () => {
      expect(sanitizeLiquifyKey('  abc123  ')).toBe('abc123')
      expect(sanitizeLiquifyKey(undefined)).toBe('')
      expect(sanitizeLiquifyKey('')).toBe('')
      expect(sanitizeLiquifyKey('abc\r\nX-Evil: 1')).toBe('')
      expect(sanitizeLiquifyKey('ab cd')).toBe('')
    })
  })

  describe('registerLiquifyAuth', () => {
    const createWebRequest = () => {
      type Details = { url: string; requestHeaders: Record<string, string> }
      const onBeforeRequest = vi.fn()
      const onBeforeSendHeaders = vi.fn()
      const webRequest = { onBeforeRequest, onBeforeSendHeaders } as unknown as LiquifyWebRequest
      const runHeaders = (url: string, requestHeaders: Record<string, string> = {}) => {
        const cb = vi.fn()
        onBeforeSendHeaders.mock.calls[0][1]({ url, requestHeaders } as Details, cb)
        return cb.mock.calls[0][0] as { requestHeaders: Record<string, string> }
      }
      const runRequest = (url: string) => {
        const cb = vi.fn()
        onBeforeRequest.mock.calls[0][1]({ url } as Details, cb)
        return cb.mock.calls[0][0] as { redirectURL?: string }
      }
      return { webRequest, onBeforeRequest, onBeforeSendHeaders, runHeaders, runRequest }
    }

    it('registers nothing when all keys are empty', () => {
      const { webRequest, onBeforeRequest, onBeforeSendHeaders } = createWebRequest()
      expect(registerLiquifyAuth(webRequest, NO_KEYS)).toEqual([])
      expect(onBeforeRequest).not.toHaveBeenCalled()
      expect(onBeforeSendHeaders).not.toHaveBeenCalled()
    })

    it('filters to https://gateway.liquify.com/* only', () => {
      const { webRequest, onBeforeRequest, onBeforeSendHeaders } = createWebRequest()
      registerLiquifyAuth(webRequest, KEYS)
      expect(onBeforeRequest.mock.calls[0][0]).toEqual({ urls: ['https://gateway.liquify.com/*'] })
      expect(onBeforeSendHeaders.mock.calls[0][0]).toEqual({ urls: ['https://gateway.liquify.com/*'] })
    })

    it('injects the header and redirects Midgard when keys are set', () => {
      const { webRequest, runHeaders, runRequest } = createWebRequest()
      expect(registerLiquifyAuth(webRequest, KEYS)).toEqual(['midgard', 'thornodeApi', 'thornodeRpc'])
      expect(runHeaders(`${GW}/v2/pools`, { Accept: 'x' }).requestHeaders).toEqual({
        Accept: 'x',
        'X-API-KEY': KEYS.midgard
      })
      expect(runRequest(`${GW}/chain/thorchain_midgard/v2/pools`)).toEqual({ redirectURL: `${GW}/v2/pools` })
      expect(runRequest(`${GW}/chain/thorchain_api/thorchain/lastblock`)).toEqual({
        redirectURL: `${GW}/thorchain/lastblock`
      })
      expect(runHeaders(`${GW}/thorchain/lastblock`, {}).requestHeaders).toEqual({ 'X-API-KEY': KEYS.thornodeApi })
      expect(runRequest(`${GW}/chain/thorchain_rpc/status`)).toEqual({})
    })

    it('does not register a root redirect with only an RPC key', () => {
      const { webRequest, onBeforeRequest, onBeforeSendHeaders } = createWebRequest()
      expect(registerLiquifyAuth(webRequest, { ...NO_KEYS, thornodeRpc: 'fake-rpc-key' })).toEqual(['thornodeRpc'])
      expect(onBeforeRequest).not.toHaveBeenCalled()
      expect(onBeforeSendHeaders).toHaveBeenCalledTimes(1)
    })

    it('does not send keys to other hosts or over http', () => {
      const { webRequest, runHeaders } = createWebRequest()
      registerLiquifyAuth(webRequest, KEYS)
      for (const url of [
        'https://midgard.thorchain.network/v2/pools',
        'http://gateway.liquify.com/v2/pools',
        'https://gateway.liquify.com.evil.io/v2/pools'
      ]) {
        expect(runHeaders(url, { Accept: 'x' }).requestHeaders).toEqual({ Accept: 'x' })
      }
    })

    it('never logs key values', () => {
      const { webRequest, runHeaders } = createWebRequest()
      const info = vi.fn()
      registerLiquifyAuth(webRequest, KEYS, { info })
      runHeaders(`${GW}/v2/pools`)
      expect(info).toHaveBeenCalledTimes(1)
      const logged = JSON.stringify(info.mock.calls)
      Object.values(KEYS).forEach((key) => expect(logged).not.toContain(key))
      expect(logged).toContain('midgard')
    })

    it('does not echo a renderer-provided header', () => {
      const { webRequest, runHeaders } = createWebRequest()
      registerLiquifyAuth(webRequest, KEYS)
      const result = runHeaders(`${GW}/v2/pools`, { 'x-api-key': 'renderer-value' })
      expect(result.requestHeaders).toEqual({ 'x-api-key': 'renderer-value' })
      expect(JSON.stringify(result)).not.toContain(KEYS.midgard)
    })
  })
})

describe('getThornodeApiRootUrl', () => {
  const GW = 'https://gateway.liquify.com'
  const K = { midgard: '', thornodeApi: 'api-key', thornodeRpc: '' }
  it('rewrites keyed /chain/thorchain_api to the gateway root', () => {
    expect(getThornodeApiRootUrl(`${GW}/chain/thorchain_api/thorchain/lastblock`, K)).toBe(`${GW}/thorchain/lastblock`)
    expect(getThornodeApiRootUrl(`${GW}/chain/thorchain_api/thorchain/mimir`, K)).toBe(`${GW}/thorchain/mimir`)
    expect(getThornodeApiRootUrl(`${GW}/chain/thorchain_api/cosmos/bank/v1beta1/balances/x?a=1`, K)).toBe(
      `${GW}/cosmos/bank/v1beta1/balances/x?a=1`
    )
  })
  it('does nothing without a key, for other products or other hosts', () => {
    expect(getThornodeApiRootUrl(`${GW}/chain/thorchain_api/thorchain/lastblock`, { ...K, thornodeApi: '' })).toBeNull()
    expect(getThornodeApiRootUrl(`${GW}/chain/thorchain_rpc/status`, K)).toBeNull()
    expect(getThornodeApiRootUrl(`${GW}/chain/thorchain_apix/thorchain/lastblock`, K)).toBeNull()
    expect(getThornodeApiRootUrl('https://evil.com/chain/thorchain_api/thorchain/lastblock', K)).toBeNull()
  })
})
