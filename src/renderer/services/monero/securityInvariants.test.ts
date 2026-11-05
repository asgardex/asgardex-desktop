import { Network } from '@xchainjs/xchain-client'

import { ViewOnlyXmrClient } from './client'
import { DEFAULT_XMR_CONNECTION_CONFIG, KeyValueStorage, saveXmrConnectionConfig, XmrConnectionConfig } from './config'
import { bytesToHex, deriveXmrExportKeys, deriveXmrViewKeys } from './derivation'
import { buildPaymentTx, createFakeDaemon } from './fakeDaemon.testHelper'
import { LwsFetch } from './lws'
import { createLwsConfirmation } from './lwsConfirmation'
import { scanStorageKey } from './scanner'

// BIP-39 test vector. NEVER use for funds.
const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const LWS_URL = 'https://lws.example/secret-path'

// All production sources (tests excluded), as raw text. Keys look like `../../chain/x.ts` (relative to this file).
const sources = import.meta.glob(['../../../**/*.{ts,tsx}', '!../../../**/*.test.{ts,tsx}', '!../../../**/*.d.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const productionFiles = Object.keys(sources)
const read = (file: string) => sources[file]
/** Directory of this test, relative to `src/` */
const HERE = ['renderer', 'services', 'monero']
/** Path relative to `src/` (glob keys are relative to this file: `./a.ts`, `../b/c.ts`) */
const rel = (file: string): string => {
  const parts = [...HERE]
  for (const segment of file.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}
const sourceOf = (srcRelative: string) => {
  const key = productionFiles.find((f) => rel(f) === srcRelative)
  if (!key) throw new Error(`source not found: ${srcRelative}`)
  return read(key)
}

describe('XMR security invariants (static)', () => {
  it('walletRpcUrls is only ever set to "none" (empty), in the view-only client', () => {
    const hits = productionFiles
      .filter((f) => read(f).includes('walletRpcUrls'))
      .map((f) => ({
        file: rel(f),
        lines: read(f)
          .split('\n')
          .filter((l) => l.includes('walletRpcUrls'))
      }))

    expect(hits.map((h) => h.file)).toEqual(['renderer/services/monero/client.ts'])
    // the only assignment passes the empty endpoint map; everything else is a comment
    const code = hits[0].lines.filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    expect(code).toHaveLength(1)
    expect(code[0]).toMatch(/walletRpcUrls:\s*none\b/)
    // `none` really is empty for every network
    expect(sourceOf('renderer/services/monero/client.ts')).toMatch(
      /const none = \{ \[Network\.Mainnet\]: \[\], \[Network\.Stagenet\]: \[\], \[Network\.Testnet\]: \[\] \}/
    )
  })

  it('sendTx$ has no XMR case (falls through to "not supported")', () => {
    const source = sourceOf('renderer/services/chain/transaction/common.ts')
    const start = source.indexOf('export const sendTx$')
    const rest = source.slice(start + 1)
    const end = rest.search(/\nexport const /)
    const block = source.slice(start, end === -1 ? undefined : start + 1 + end)
    expect(block.length).toBeGreaterThan(500)
    expect(block).not.toMatch(/case XMRChain/)
    expect(block).not.toMatch(/\bXMR\./)
    expect(block).toContain("is not supported for 'sendPoolTx$'")
  })

  it('no production code calls transfer / sendTx / setPhrase on the Monero client', () => {
    const monero = productionFiles.filter((f) => rel(f).startsWith('renderer/services/monero/'))
    for (const file of monero) {
      const code = read(file)
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
        .join('\n')
      expect(code, rel(file)).not.toMatch(/client\.(transfer|setPhrase|broadcastTx)\(/)
      expect(code, rel(file)).not.toMatch(/\.(transfer|setPhrase|broadcastTx)\(\s*\{?\s*(phrase|walletAccount)/)
    }
  })

  it('the Monero client is never constructed with a phrase', () => {
    for (const file of productionFiles.filter((f) => read(f).includes('ViewOnlyXmrClient('))) {
      expect(read(file), rel(file)).not.toMatch(/new ViewOnlyXmrClient\(\{[^}]*phrase/s)
    }
    for (const file of productionFiles.filter((f) => read(f).includes("from '@xchainjs/xchain-monero'"))) {
      // `new Client({ ... phrase })` of the SDK must not appear anywhere
      expect(read(file), rel(file)).not.toMatch(/new Client\(/)
    }
  })
})

describe('XMR security invariants (end to end): no path sends the phrase or the spend key', () => {
  const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
  const exported = deriveXmrExportKeys(PHRASE, Network.Mainnet)
  const AMOUNT = BigInt(1_000_000_000_000)

  const memoryStorage = (): KeyValueStorage & { dump: () => string } => {
    const data: Record<string, string> = {}
    return {
      getItem: (k) => data[k] ?? null,
      setItem: (k, v) => void (data[k] = v),
      dump: () => JSON.stringify(data)
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('daemon scan, LWS login / balance / history, persisted state and logs', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT })
    const daemon = createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx })
    vi.stubGlobal('fetch', daemon.fetch)

    const lwsRequests: Array<{ url: string; body: string }> = []
    const lwsFetch: LwsFetch = async (url, init) => {
      lwsRequests.push({ url, body: init.body })
      const path = url.slice(LWS_URL.length)
      const json =
        path === '/get_address_info'
          ? { total_received: '5', total_sent: '1' }
          : path === '/get_address_txs'
            ? { transactions: [] }
            : {}
      return { ok: true, status: 200, json: () => Promise.resolve(json) }
    }

    const storage = memoryStorage()
    const make = (config: XmrConnectionConfig) =>
      new ViewOnlyXmrClient({ viewKeys, network: Network.Mainnet, config, deps: { storage, lwsFetch } })

    // 1. local scan (default: no LWS)
    const local = make(DEFAULT_XMR_CONNECTION_CONFIG)
    await local.getBalance(viewKeys.address)
    await local.getTransactions()

    // 2. confirmed LWS
    const lwsConfig: XmrConnectionConfig = {
      ...DEFAULT_XMR_CONNECTION_CONFIG,
      lwsUrl: LWS_URL,
      lwsConfirmation: createLwsConfirmation(viewKeys, LWS_URL)
    }
    saveXmrConnectionConfig(lwsConfig, storage)
    const viaLws = make(lwsConfig)
    await viaLws.getBalance(viewKeys.address)
    await viaLws.getTransactions()

    const secrets = [exported.privateSpendKeyHex, PHRASE, PHRASE.split(' ').slice(0, 3).join(' '), 'abandon abandon']
    const outgoing = [
      ...daemon.requests().map((r) => `${r.url}\n${r.body}`),
      ...lwsRequests.map((r) => `${r.url}\n${r.body}`)
    ]
    expect(daemon.requests().length).toBeGreaterThan(0)
    expect(lwsRequests.length).toBeGreaterThan(0)
    for (const secret of secrets) {
      for (const request of outgoing) expect(request).not.toContain(secret)
      expect(storage.dump()).not.toContain(secret)
      for (const spy of [log, warn, error]) expect(JSON.stringify(spy.mock.calls)).not.toContain(secret)
    }

    // the private view key goes to the confirmed LWS only: never to a daemon, never to storage
    const viewKeyHex = bytesToHex(viewKeys.privateViewKey)
    expect(lwsRequests.every((r) => r.body.includes(viewKeyHex))).toBe(true)
    for (const request of daemon.requests()) expect(`${request.url}\n${request.body}`).not.toContain(viewKeyHex)
    expect(storage.dump()).not.toContain(viewKeyHex)
    expect(storage.getItem(scanStorageKey(Network.Mainnet, viewKeys.address))).not.toBeNull()
  })
})
