import { Network } from '@xchainjs/xchain-client'
import { defaultXMRParams } from '@xchainjs/xchain-monero'

import {
  DEFAULT_XMR_CONNECTION_CONFIG,
  fetchDaemonHeight,
  getDaemonUrl,
  isValidXmrEndpoint,
  KeyValueStorage,
  loadXmrConnectionConfig,
  normalizeXmrEndpoint,
  redactXmrEndpoint,
  sanitizeXmrConnectionConfig,
  saveXmrConnectionConfig,
  XMR_CONNECTION_STORAGE_KEY
} from './config'

const memoryStorage = (initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v
    }
  }
}

const TAG = 'a'.repeat(64)

describe('services/monero/config', () => {
  describe('privacy defaults', () => {
    it('has no light-wallet server (view key stays local), no confirmation and no explicit restore height', () => {
      expect(DEFAULT_XMR_CONNECTION_CONFIG).toEqual({
        daemonUrl: '',
        lwsUrl: '',
        lwsConfirmation: null,
        restoreHeight: null
      })
    })
  })

  describe('isValidXmrEndpoint', () => {
    it.each([
      'https://node.example.com',
      'https://node.example.com:18081',
      'https://node.example.com/secret-token/path',
      'http://localhost:18081',
      'http://127.0.0.1:18081',
      'http://127.1.2.3:18081',
      'http://[::1]:18081'
    ])('accepts %s', (url) => expect(isValidXmrEndpoint(url)).toBe(true))

    it.each([
      '',
      'node.example.com',
      'http://node.example.com:18081', // plain http to a remote host
      'ftp://node.example.com',
      'https://user:pass@node.example.com',
      'https://node.example.com?x=1',
      'https://node.example.com#frag',
      'javascript:alert(1)'
    ])('rejects %s', (url) => expect(isValidXmrEndpoint(url)).toBe(false))

    describe('LAN ranges are rejected for http (loopback only)', () => {
      it.each([
        'http://10.0.0.2:18081',
        'http://10.255.255.255',
        'http://172.16.0.1',
        'http://172.20.1.1:18081',
        'http://172.31.255.255',
        'http://192.168.1.10:18081',
        'http://192.168.0.1',
        'http://169.254.1.1',
        'http://192.169.1.10'
      ])('rejects %s', (url) => expect(isValidXmrEndpoint(url)).toBe(false))

      it('https to a LAN host is still just https (transport security is the point)', () => {
        expect(isValidXmrEndpoint('https://192.168.1.10:18081')).toBe(true)
      })
    })

    describe('evil-host cases (not loopback, must not pass as loopback)', () => {
      it.each([
        'http://localhost.evil.com',
        'http://localhost.evil.com:18081',
        'http://localhost@evil.com', // userinfo trick: host is evil.com
        'http://localhost:80@evil.com',
        'http://127.0.0.1@evil.com',
        'http://127.0.0.1.evil.com',
        'http://127.0.0.1.nip.io',
        'http://evil.com#@localhost',
        'http://evil.com/@localhost',
        'http://localhost%2eevil.com', // %2e = "."
        'http://localhost%2Eevil.com',
        'http://localhost%2e',
        'http://evil.com%2f@localhost',
        'http://127%2e0%2e0%2e1.evil.com',
        'http://xn--localhost-9ua.com',
        'http://localhost.',
        'http://sub.localhost',
        'http://0.0.0.0',
        'http://[::ffff:7f00:1]', // v4-mapped: not accepted
        'http://[::2]',
        'http://[fe80::1]',
        'http://[fd00::1]',
        'http://\u2460\u2467.0.0.1' // unicode digits
      ])('rejects %s', (url) => expect(isValidXmrEndpoint(url)).toBe(false))

      it('the URL parser (not string matching) decides the host', () => {
        // WHATWG normalises these to loopback, so they are accepted for the right reason
        expect(isValidXmrEndpoint('http://127.1')).toBe(true) // -> 127.0.0.1
        expect(isValidXmrEndpoint('http://2130706433')).toBe(true) // -> 127.0.0.1
        expect(isValidXmrEndpoint('http://[0:0:0:0:0:0:0:1]')).toBe(true) // -> [::1]
        expect(isValidXmrEndpoint('http://LOCALHOST:18081')).toBe(true)
      })
    })
  })

  it('normalizeXmrEndpoint trims and removes trailing slashes', () => {
    expect(normalizeXmrEndpoint('  https://a.b/// ')).toBe('https://a.b')
  })

  describe('redactXmrEndpoint (never expose the path)', () => {
    it('keeps scheme and host only', () => {
      expect(redactXmrEndpoint('https://lws.example.com:8443/very/secret/token')).toBe('https://lws.example.com:8443')
      expect(redactXmrEndpoint('https://lws.example.com/abc')).not.toContain('abc')
      expect(redactXmrEndpoint('not a url')).toBe('<invalid url>')
    })
  })

  describe('sanitizeXmrConnectionConfig', () => {
    it('keeps valid values, and a confirmation for exactly the stored LWS URL', () => {
      expect(
        sanitizeXmrConnectionConfig({
          daemonUrl: 'https://a.b/',
          lwsUrl: 'http://localhost:8080',
          lwsConfirmation: { url: 'http://localhost:8080', tag: TAG },
          restoreHeight: 3000000
        })
      ).toEqual({
        daemonUrl: 'https://a.b',
        lwsUrl: 'http://localhost:8080',
        lwsConfirmation: { url: 'http://localhost:8080', tag: TAG },
        restoreHeight: 3000000
      })
    })

    it('drops the confirmation when the LWS URL differs (URL edited in storage)', () => {
      const result = sanitizeXmrConnectionConfig({
        lwsUrl: 'https://evil.example',
        lwsConfirmation: { url: 'https://good.example', tag: TAG }
      })
      expect(result.lwsUrl).toBe('https://evil.example')
      expect(result.lwsConfirmation).toBeNull()
    })

    it('drops malformed confirmations and confirmations without an LWS URL', () => {
      expect(
        sanitizeXmrConnectionConfig({ lwsUrl: 'https://a.b', lwsConfirmation: { url: 'https://a.b', tag: 'zz' } })
          .lwsConfirmation
      ).toBeNull()
      expect(sanitizeXmrConnectionConfig({ lwsUrl: 'https://a.b', lwsConfirmation: 'yes' }).lwsConfirmation).toBeNull()
      expect(
        sanitizeXmrConnectionConfig({ lwsUrl: '', lwsConfirmation: { url: '', tag: TAG } }).lwsConfirmation
      ).toBeNull()
    })

    it('drops invalid / tampered values', () => {
      expect(sanitizeXmrConnectionConfig({ daemonUrl: 'http://evil.example', lwsUrl: 42, restoreHeight: -1 })).toEqual(
        DEFAULT_XMR_CONNECTION_CONFIG
      )
      expect(sanitizeXmrConnectionConfig({ lwsUrl: 'http://192.168.1.2:8080' }).lwsUrl).toBe('')
      expect(sanitizeXmrConnectionConfig({ restoreHeight: 1.5 }).restoreHeight).toBeNull()
      expect(sanitizeXmrConnectionConfig(null)).toEqual(DEFAULT_XMR_CONNECTION_CONFIG)
      expect(sanitizeXmrConnectionConfig('x')).toEqual(DEFAULT_XMR_CONNECTION_CONFIG)
    })
  })

  describe('load / save', () => {
    it('returns defaults without stored value or on corrupt JSON', () => {
      expect(loadXmrConnectionConfig(memoryStorage())).toEqual(DEFAULT_XMR_CONNECTION_CONFIG)
      expect(loadXmrConnectionConfig(memoryStorage({ [XMR_CONNECTION_STORAGE_KEY]: '{not json' }))).toEqual(
        DEFAULT_XMR_CONNECTION_CONFIG
      )
    })

    it('round-trips and sanitizes on save', () => {
      const storage = memoryStorage()
      saveXmrConnectionConfig(
        {
          daemonUrl: 'https://a.b/',
          lwsUrl: 'http://remote.example',
          lwsConfirmation: { url: 'http://remote.example', tag: TAG },
          restoreHeight: 5
        },
        storage
      )
      expect(loadXmrConnectionConfig(storage)).toEqual({
        daemonUrl: 'https://a.b',
        lwsUrl: '',
        lwsConfirmation: null,
        restoreHeight: 5
      })
    })

    it('a confirmation loaded together with an edited URL does not survive', () => {
      const storage = memoryStorage({
        [XMR_CONNECTION_STORAGE_KEY]: JSON.stringify({
          daemonUrl: '',
          lwsUrl: 'https://attacker.example/x',
          lwsConfirmation: { url: 'https://my-lws.example', tag: TAG },
          restoreHeight: null
        })
      })
      const loaded = loadXmrConnectionConfig(storage)
      expect(loaded.lwsUrl).toBe('https://attacker.example/x')
      expect(loaded.lwsConfirmation).toBeNull()
    })
  })

  describe('getDaemonUrl', () => {
    it('prefers custom, falls back to the first default', () => {
      expect(getDaemonUrl({ ...DEFAULT_XMR_CONNECTION_CONFIG, daemonUrl: 'https://my.node' }, Network.Mainnet)).toBe(
        'https://my.node'
      )
      expect(getDaemonUrl(DEFAULT_XMR_CONNECTION_CONFIG, Network.Mainnet)).toBe(
        defaultXMRParams.daemonUrls?.[Network.Mainnet][0]
      )
    })
  })

  describe('fetchDaemonHeight', () => {
    const fetchWith = (ok: boolean, body: unknown) =>
      vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) })

    it('reads get_block_count', async () => {
      const fetchFn = fetchWith(true, { result: { count: 3700000 } })
      await expect(fetchDaemonHeight('https://n', fetchFn)).resolves.toBe(3700000)
      expect(fetchFn.mock.calls[0][0]).toBe('https://n/json_rpc')
      expect(JSON.parse(fetchFn.mock.calls[0][1].body).method).toBe('get_block_count')
    })

    it('does not follow redirects', async () => {
      const fetchFn = fetchWith(true, { result: { count: 5 } })
      await fetchDaemonHeight('https://n', fetchFn)
      expect(fetchFn.mock.calls[0][1].redirect).toBe('error')
    })

    it('throws on HTTP error or malformed result', async () => {
      await expect(fetchDaemonHeight('https://n', fetchWith(false, {}))).rejects.toThrow()
      await expect(fetchDaemonHeight('https://n', fetchWith(true, { result: { count: 'x' } }))).rejects.toThrow()
      await expect(fetchDaemonHeight('https://n', fetchWith(true, {}))).rejects.toThrow()
    })
  })
})
