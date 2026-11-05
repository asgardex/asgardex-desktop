import { Network } from '@xchainjs/xchain-client'

import { firstValueFrom } from 'rxjs'

import { xmrBalanceInfo$ } from './balanceSource'
import { createReadOnlyXmrClient, ViewOnlyXmrClient, XMR_SEND_DISABLED_MSG } from './client'
import { DEFAULT_XMR_CONNECTION_CONFIG, KeyValueStorage, XmrConnectionConfig } from './config'
import { deriveXmrExportKeys, deriveXmrViewKeys } from './derivation'
import { buildPaymentTx, createFakeDaemon } from './fakeDaemon.testHelper'
import { LwsFetch } from './lws'
import { createLwsConfirmation } from './lwsConfirmation'
import { defaultScanDeps, mainnetTimeOfHeight } from './scanner'

// BIP-39 test vector. NEVER use for funds.
const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const LWS_URL = 'https://lws.example/secret-path'
const AMOUNT = BigInt(1_230_000_000_000)

const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
const exported = deriveXmrExportKeys(PHRASE, Network.Mainnet)

const memoryStorage = (): KeyValueStorage => {
  const data: Record<string, string> = {}
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

const make = (config: XmrConnectionConfig = DEFAULT_XMR_CONNECTION_CONFIG, lwsFetch?: LwsFetch) =>
  new ViewOnlyXmrClient({
    viewKeys,
    network: Network.Mainnet,
    config,
    // the fake chain is at height ~3,000,000: the clock follows it (tip sanity check)
    deps: {
      storage: memoryStorage(),
      lwsFetch,
      scanDeps: { ...defaultScanDeps, now: () => mainnetTimeOfHeight(3_000_000) }
    }
  })

const lwsFetchMock = (info: Record<string, string> = { total_received: '7000000000000', total_sent: '1' }) =>
  vi.fn(async (url: string, init: { body: string }) => {
    const path = url.slice(LWS_URL.length)
    const json =
      path === '/get_address_info'
        ? info
        : path === '/get_address_txs'
          ? {
              transactions: [
                { hash: 'h1', timestamp: '2026-01-01T00:00:00Z', total_received: '7000000000000', height: 5 }
              ]
            }
          : {}
    void init
    return { ok: true, status: 200, json: () => Promise.resolve(json) }
  }) as unknown as LwsFetch & ReturnType<typeof vi.fn>

describe('services/monero/client (ViewOnlyXmrClient)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchSpy = vi.fn(() => Promise.reject(new Error('network access is not expected in this test')))
    vi.stubGlobal('fetch', fetchSpy)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('address', () => {
    it('is the address of the view keys, derived locally without network access', async () => {
      const client = make()
      expect(client.getAddress(0)).toBe(viewKeys.address)
      await expect(client.getAddressAsync(0)).resolves.toBe(viewKeys.address)
      expect(client.validateAddress(viewKeys.address)).toBe(true)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('supports index 0 only', () => {
      expect(() => make().getAddress(1)).toThrow(/index 0/)
    })

    it('rejects view keys of another network', () => {
      expect(
        () => new ViewOnlyXmrClient({ viewKeys, network: Network.Stagenet, config: DEFAULT_XMR_CONNECTION_CONFIG })
      ).toThrow()
    })
  })

  describe('never holds the phrase or the spend key', () => {
    it('the client has no phrase and no wallet-rpc / LWS endpoints of the SDK', () => {
      const client = make({ ...DEFAULT_XMR_CONNECTION_CONFIG, lwsUrl: LWS_URL }) as unknown as Record<string, unknown>
      expect(client.phrase ?? '').toBe('')
      for (const field of ['walletRpcUrls', 'lwsUrls']) {
        const urls = client[field] as Record<string, string[]>
        expect(Object.values(urls).flat()).toEqual([])
      }
    })

    it('nothing in the client object graph contains the phrase or spend key', () => {
      const client = make({ ...DEFAULT_XMR_CONNECTION_CONFIG, lwsUrl: LWS_URL })
      const seen = new Set<unknown>()
      const strings: string[] = []
      const walk = (v: unknown) => {
        if (v === null || seen.has(v)) return
        if (typeof v === 'string') return void strings.push(v)
        if (v instanceof Uint8Array)
          return void strings.push(Array.from(v, (b) => b.toString(16).padStart(2, '0')).join(''))
        if (typeof v !== 'object') return
        seen.add(v)
        Object.values(v as object).forEach(walk)
      }
      walk(client)
      const blob = strings.join('\n')
      expect(blob).not.toContain(exported.privateSpendKeyHex)
      expect(blob).not.toContain(PHRASE.split(' ').slice(0, 4).join(' '))
    })

    it('setPhrase, transfer, broadcastTx and wallet-rpc balance are disabled', async () => {
      const client = make()
      expect(() => client.setPhrase(PHRASE)).toThrow()
      await expect(client.transfer()).rejects.toThrow(XMR_SEND_DISABLED_MSG)
      await expect(client.broadcastTx()).rejects.toThrow(XMR_SEND_DISABLED_MSG)
      await expect(client.getWalletBalanceDetail()).rejects.toThrow()
      await expect(client.prepareTx({} as never)).rejects.toThrow()
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('daemon scanning (default: no LWS, view key stays local)', () => {
    it('balance and history come from the local scan', async () => {
      const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT })
      const daemon = createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx })
      vi.stubGlobal('fetch', daemon.fetch)
      const client = make()

      const [balance] = await client.getBalance(viewKeys.address)
      expect(balance.amount.amount().toString()).toBe(AMOUNT.toString())
      expect(balance.asset.chain).toBe('XMR')

      const page = await client.getTransactions()
      expect(page.total).toBe(1)
      expect(page.txs[0].to[0].to).toBe(viewKeys.address)
      expect(page.txs[0].to[0].amount.amount().toString()).toBe(AMOUNT.toString())
      expect(page.txs[0].from).toEqual([])
    })

    it('only for the own address', async () => {
      await expect(make().getBalance('4SomeoneElse')).rejects.toThrow(/own Monero address/)
      await expect(make().getTransactions({ address: '4SomeoneElse' })).rejects.toThrow(/own Monero address/)
    })

    it('uses the configured node', async () => {
      const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT })
      const daemon = createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx })
      vi.stubGlobal('fetch', daemon.fetch)
      await make({ ...DEFAULT_XMR_CONNECTION_CONFIG, daemonUrl: 'https://my.node' }).getBalance(viewKeys.address)
      expect(daemon.requests().every((r) => r.url.startsWith('https://my.node/'))).toBe(true)
    })
  })

  describe('light-wallet server (opt-in, needs an in-app confirmation of exactly this URL)', () => {
    it('unconfirmed URL: no request to the LWS, local scan is used (nothing is sent to the LWS)', async () => {
      const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT })
      const daemon = createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx })
      vi.stubGlobal('fetch', daemon.fetch)
      const lwsFetch = lwsFetchMock()
      const client = make({ ...DEFAULT_XMR_CONNECTION_CONFIG, lwsUrl: LWS_URL, lwsConfirmation: null }, lwsFetch)

      const [balance] = await client.getBalance(viewKeys.address)
      await client.getTransactions()
      expect(lwsFetch).not.toHaveBeenCalled()
      expect(balance.amount.amount().toString()).toBe(AMOUNT.toString())
    })

    it('URL edited in storage (confirmation belongs to another URL): never sends the view key', async () => {
      const lwsFetch = lwsFetchMock()
      const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT })
      vi.stubGlobal('fetch', createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx }).fetch)
      const config: XmrConnectionConfig = {
        ...DEFAULT_XMR_CONNECTION_CONFIG,
        lwsUrl: 'https://attacker.example',
        lwsConfirmation: createLwsConfirmation(viewKeys, LWS_URL) // confirmation of the ORIGINAL url
      }
      await make(config, lwsFetch).getBalance(viewKeys.address)
      expect(lwsFetch).not.toHaveBeenCalled()
    })

    it('confirmation made with another wallet (same URL): never sends the view key (confirmations are per wallet)', async () => {
      const lwsFetch = lwsFetchMock()
      const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT })
      vi.stubGlobal('fetch', createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx }).fetch)
      const otherWallet = deriveXmrViewKeys(
        'legal winner thank year wave sausage worth useful legal winner thank yellow',
        Network.Mainnet
      )
      const config: XmrConnectionConfig = {
        ...DEFAULT_XMR_CONNECTION_CONFIG,
        lwsUrl: LWS_URL,
        lwsConfirmation: createLwsConfirmation(otherWallet, LWS_URL)
      }
      await make(config, lwsFetch).getBalance(viewKeys.address)
      expect(lwsFetch).not.toHaveBeenCalled()
    })

    it('confirmed URL: registers once, then uses the balance reported by the server', async () => {
      const lwsFetch = lwsFetchMock()
      const client = make(
        {
          ...DEFAULT_XMR_CONNECTION_CONFIG,
          lwsUrl: LWS_URL,
          lwsConfirmation: createLwsConfirmation(viewKeys, LWS_URL)
        },
        lwsFetch
      )
      const [balance] = await client.getBalance(viewKeys.address)
      // received only: the spends the server reports (total_sent: 1) are NOT subtracted
      expect(balance.amount.amount().toString()).toBe('7000000000000')
      expect(await firstValueFrom(xmrBalanceInfo$)).toEqual({ source: 'lws', serverReportedSpent: BigInt(1) })
      await client.getBalance(viewKeys.address)
      const paths = lwsFetch.mock.calls.map(([url]: [string]) => url.slice(LWS_URL.length))
      expect(paths.filter((p: string) => p === '/login')).toHaveLength(1)
      expect(fetchSpy).not.toHaveBeenCalled() // no daemon scan when the LWS is used

      const page = await client.getTransactions()
      expect(page.txs).toHaveLength(1)
      for (const [, init] of lwsFetch.mock.calls as Array<[string, { body: string }]>) {
        expect(init.body).not.toContain(exported.privateSpendKeyHex)
        expect(init.body).not.toContain('abandon')
      }
    })
  })

  describe('balance source (what the number means)', () => {
    const lwsConfig = (): XmrConnectionConfig => ({
      ...DEFAULT_XMR_CONNECTION_CONFIG,
      lwsUrl: LWS_URL,
      lwsConfirmation: createLwsConfirmation(viewKeys, LWS_URL)
    })

    it('local scan: total received, spends not tracked', async () => {
      const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT })
      vi.stubGlobal('fetch', createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx }).fetch)
      const lwsLess = make(DEFAULT_XMR_CONNECTION_CONFIG)
      await lwsLess.getBalance(viewKeys.address)
      expect(await firstValueFrom(xmrBalanceInfo$)).toEqual({ source: 'local-scan' })
    })

    it('LWS that reports more spends than received: the balance is still the received amount (spends are never subtracted)', async () => {
      const client = make(lwsConfig(), lwsFetchMock({ total_received: '5', total_sent: '9' }))
      const [balance] = await client.getBalance(viewKeys.address)
      expect(balance.amount.amount().toString()).toBe('5')
      // handed to the UI separately, unverified
      expect(await firstValueFrom(xmrBalanceInfo$)).toEqual({ source: 'lws', serverReportedSpent: BigInt(9) })
    })

    it('LWS that does not report spends: just "received", no spends line', async () => {
      const client = make(lwsConfig(), lwsFetchMock({ total_received: '5' }))
      const [balance] = await client.getBalance(viewKeys.address)
      expect(balance.amount.amount().toString()).toBe('5')
      expect(await firstValueFrom(xmrBalanceInfo$)).toEqual({ source: 'lws', serverReportedSpent: undefined })
    })
  })

  describe('read-only client (no wallet)', () => {
    it('provides explorer urls and address validation, but no address', () => {
      const client = createReadOnlyXmrClient(Network.Mainnet)
      expect(client.getExplorerUrl()).toContain('xmrchain.net')
      expect(client.validateAddress(viewKeys.address)).toBe(true)
      expect(() => client.getAddress(0)).toThrow()
    })
  })
})
