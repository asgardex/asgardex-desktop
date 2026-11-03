import { Network } from '@xchainjs/xchain-client'
import { defaultXMRParams } from '@xchainjs/xchain-monero'
import { option as O } from 'fp-ts'

import {
  buildXmrClientParams,
  DEFAULT_XMR_CONNECTION_CONFIG,
  fetchDaemonHeight,
  getDaemonUrl,
  isValidXmrEndpoint,
  KeyValueStorage,
  loadXmrConnectionConfig,
  normalizeXmrEndpoint,
  resolveRestoreHeight,
  sanitizeXmrConnectionConfig,
  saveXmrConnectionConfig,
  XMR_BIRTH_HEIGHT_MARGIN,
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

describe('services/monero/config', () => {
  describe('privacy defaults', () => {
    it('has no light-wallet server (view key stays local) and no explicit restore height', () => {
      expect(DEFAULT_XMR_CONNECTION_CONFIG).toEqual({ daemonUrl: '', lwsUrl: '', restoreHeight: null })
    })

    it('never configures an LWS or wallet-rpc by default', () => {
      const params = buildXmrClientParams({
        config: DEFAULT_XMR_CONNECTION_CONFIG,
        network: Network.Mainnet,
        restoreHeight: 100
      })
      for (const network of [Network.Mainnet, Network.Stagenet, Network.Testnet]) {
        expect(params.lwsUrls?.[network]).toEqual([])
        expect(params.walletRpcUrls?.[network]).toEqual([])
      }
      expect(params.restoreHeight).toBe(100)
      // SDK default daemons are kept
      expect(params.daemonUrls).toEqual(defaultXMRParams.daemonUrls)
    })
  })

  describe('isValidXmrEndpoint', () => {
    it.each([
      'https://node.example.com',
      'https://node.example.com:18081',
      'http://localhost:18081',
      'http://127.0.0.1:18081',
      'http://192.168.1.10:18081',
      'http://10.0.0.2:18081'
    ])('accepts %s', (url) => expect(isValidXmrEndpoint(url)).toBe(true))

    it.each([
      '',
      'node.example.com',
      'http://node.example.com:18081', // plain http to a remote host
      'ftp://node.example.com',
      'https://user:pass@node.example.com',
      'https://node.example.com?x=1',
      'https://node.example.com#frag',
      'javascript:alert(1)',
      'http://192.169.1.10' // not a private range
    ])('rejects %s', (url) => expect(isValidXmrEndpoint(url)).toBe(false))
  })

  it('normalizeXmrEndpoint trims and removes trailing slashes', () => {
    expect(normalizeXmrEndpoint('  https://a.b/// ')).toBe('https://a.b')
  })

  describe('sanitizeXmrConnectionConfig', () => {
    it('keeps valid values', () => {
      expect(
        sanitizeXmrConnectionConfig({
          daemonUrl: 'https://a.b/',
          lwsUrl: 'http://localhost:8080',
          restoreHeight: 3000000
        })
      ).toEqual({ daemonUrl: 'https://a.b', lwsUrl: 'http://localhost:8080', restoreHeight: 3000000 })
    })

    it('drops invalid / tampered values', () => {
      expect(sanitizeXmrConnectionConfig({ daemonUrl: 'http://evil.example', lwsUrl: 42, restoreHeight: -1 })).toEqual(
        DEFAULT_XMR_CONNECTION_CONFIG
      )
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
      saveXmrConnectionConfig({ daemonUrl: 'https://a.b/', lwsUrl: 'http://remote.example', restoreHeight: 5 }, storage)
      expect(loadXmrConnectionConfig(storage)).toEqual({ daemonUrl: 'https://a.b', lwsUrl: '', restoreHeight: 5 })
    })
  })

  describe('buildXmrClientParams', () => {
    it('applies custom daemon / LWS to the selected network only', () => {
      const params = buildXmrClientParams({
        config: { daemonUrl: 'https://my.node', lwsUrl: 'https://my.lws', restoreHeight: null },
        network: Network.Mainnet,
        restoreHeight: 1
      })
      expect(params.daemonUrls?.[Network.Mainnet]).toEqual(['https://my.node'])
      expect(params.daemonUrls?.[Network.Stagenet]).toEqual(defaultXMRParams.daemonUrls?.[Network.Stagenet])
      expect(params.lwsUrls?.[Network.Mainnet]).toEqual(['https://my.lws'])
      expect(params.lwsUrls?.[Network.Stagenet]).toEqual([])
      // sending is never enabled
      expect(params.walletRpcUrls?.[Network.Mainnet]).toEqual([])
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

    it('throws on HTTP error or malformed result', async () => {
      await expect(fetchDaemonHeight('https://n', fetchWith(false, {}))).rejects.toThrow()
      await expect(fetchDaemonHeight('https://n', fetchWith(true, { result: { count: 'x' } }))).rejects.toThrow()
      await expect(fetchDaemonHeight('https://n', fetchWith(true, {}))).rejects.toThrow()
    })
  })

  describe('resolveRestoreHeight', () => {
    const base = { network: Network.Mainnet, address: '4Abc' }

    it('uses the explicit restore height without any network call', async () => {
      const fetchHeight = vi.fn()
      const res = await resolveRestoreHeight({
        ...base,
        config: { ...DEFAULT_XMR_CONNECTION_CONFIG, restoreHeight: 123 },
        storage: memoryStorage(),
        fetchHeight
      })
      expect(res).toEqual(O.some(123))
      expect(fetchHeight).not.toHaveBeenCalled()
    })

    it('fetches tip - margin on first use and remembers it per address', async () => {
      const storage = memoryStorage()
      const fetchHeight = vi.fn().mockResolvedValue(3_700_000)
      const first = await resolveRestoreHeight({
        ...base,
        config: DEFAULT_XMR_CONNECTION_CONFIG,
        storage,
        fetchHeight
      })
      expect(first).toEqual(O.some(3_700_000 - XMR_BIRTH_HEIGHT_MARGIN))

      // later: tip moved on, stored birth height is kept
      fetchHeight.mockResolvedValue(3_800_000)
      const second = await resolveRestoreHeight({
        ...base,
        config: DEFAULT_XMR_CONNECTION_CONFIG,
        storage,
        fetchHeight
      })
      expect(second).toEqual(O.some(3_700_000 - XMR_BIRTH_HEIGHT_MARGIN))
      expect(fetchHeight).toHaveBeenCalledTimes(1)

      // another address gets its own height
      const other = await resolveRestoreHeight({
        ...base,
        address: '4Other',
        config: DEFAULT_XMR_CONNECTION_CONFIG,
        storage,
        fetchHeight
      })
      expect(other).toEqual(O.some(3_800_000 - XMR_BIRTH_HEIGHT_MARGIN))
    })

    it('never goes below 0', async () => {
      const res = await resolveRestoreHeight({
        ...base,
        config: DEFAULT_XMR_CONNECTION_CONFIG,
        storage: memoryStorage(),
        fetchHeight: vi.fn().mockResolvedValue(10)
      })
      expect(res).toEqual(O.some(0))
    })

    it('returns none when the daemon is not reachable (and stores nothing)', async () => {
      const storage = memoryStorage()
      const res = await resolveRestoreHeight({
        ...base,
        config: DEFAULT_XMR_CONNECTION_CONFIG,
        storage,
        fetchHeight: vi.fn().mockRejectedValue(new Error('offline'))
      })
      expect(res).toEqual(O.none)
      expect(storage.data).toEqual({})
    })
  })
})
