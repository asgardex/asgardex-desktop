import { Network } from '@xchainjs/xchain-client'

import { KeyValueStorage } from './config'
import { deriveXmrExportKeys, deriveXmrViewKeys } from './derivation'
import { buildPaymentTx, createFakeDaemon, TxForgery } from './fakeDaemon.testHelper'
import { defaultScanDeps, loadScanState, mainnetTimeOfHeight, scanXmrWallet, totalReceived } from './scanner'

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const AMOUNT = BigInt(2_500_000_000_000)
// the fake chain is at height ~3,000,000: the clock follows it (see tip sanity check in scanner.ts)
const deps = { ...defaultScanDeps, now: () => mainnetTimeOfHeight(3_000_000) }

const memoryStorage = (): KeyValueStorage => {
  const data: Record<string, string> = {}
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

describe('scanner with the real scanBlocks (view-only keys, fake daemon)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('finds a payment and decrypts the amount without the private spend key', async () => {
    const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
    const exported = deriveXmrExportKeys(PHRASE, Network.Mainnet)
    const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT })
    const daemon = createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx })
    vi.stubGlobal('fetch', daemon.fetch)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const storage = memoryStorage()
    const state = await scanXmrWallet({
      viewKeys,
      daemonUrl: 'https://node.example',
      restoreHeight: null,
      storage,
      deps
    })
    expect(state.outputs).toHaveLength(1)
    expect(totalReceived(state)).toBe(AMOUNT)
    expect(state.outputs[0].height).toBe(2_999_900)

    // nothing the scanner sent to the node contains key material
    const sent = daemon
      .requests()
      .map((r) => r.url + r.body)
      .join('\n')
    expect(sent).not.toContain(exported.privateSpendKeyHex)
    expect(sent).not.toContain(exported.privateViewKeyHex)
    expect(sent).not.toContain(PHRASE.split(' ').slice(0, 3).join(' '))

    // every request to the node (SDK scanner and our own get_transactions) refuses redirects
    expect(daemon.requests().length).toBeGreaterThan(0)
    for (const r of daemon.requests()) expect(r.redirect).toBe('error')
    expect(daemon.requests().some((r) => r.url.endsWith('/get_transactions'))).toBe(true)
    expect(state.rejected).toEqual([])

    // a restart keeps the balance without rescanning the window
    const requestsBefore = daemon.requests().length
    daemon.setTip(3_000_005)
    const again = await scanXmrWallet({
      viewKeys,
      daemonUrl: 'https://node.example',
      restoreHeight: null,
      storage,
      deps
    })
    expect(totalReceived(again)).toBe(AMOUNT)
    const headerRanges = daemon
      .requests()
      .slice(requestsBefore)
      .filter((r) => r.body.includes('get_block_headers_range'))
      .map((r) => JSON.parse(r.body).params)
    expect(headerRanges[0].start_height).toBe(3_000_000 - 10)
  })

  it('a different wallet does not see the payment', async () => {
    const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
    const exported = deriveXmrExportKeys(PHRASE, Network.Mainnet)
    const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT })
    const daemon = createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx })
    vi.stubGlobal('fetch', daemon.fetch)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const other = deriveXmrViewKeys(
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
      Network.Mainnet
    )
    const state = await scanXmrWallet({
      viewKeys: other,
      daemonUrl: 'https://node.example',
      restoreHeight: null,
      storage: memoryStorage(),
      deps
    })
    expect(state.outputs).toHaveLength(0)
  })

  describe('amount verification against the commitment (a node cannot inflate an incoming amount)', () => {
    const scan = async (forge: TxForgery | undefined, omitTxBody = false) => {
      const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
      const exported = deriveXmrExportKeys(PHRASE, Network.Mainnet)
      const tx = buildPaymentTx({ viewKeys, publicViewKeyHex: exported.publicViewKeyHex, amount: AMOUNT, forge })
      const daemon = createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx, omitTxBody })
      vi.stubGlobal('fetch', daemon.fetch)
      vi.spyOn(console, 'log').mockImplementation(() => undefined)
      const storage = memoryStorage()
      const run = () =>
        scanXmrWallet({ viewKeys, daemonUrl: 'https://node.example', restoreHeight: null, storage, deps })
      return { run, storage, viewKeys }
    }

    it('valid commitment: counted', async () => {
      const { run } = await scan(undefined)
      const state = await run()
      expect(totalReceived(state)).toBe(AMOUNT)
      expect(state.rejected).toEqual([])
    })

    it('forged amount (ecdhInfo inflated 10x, outPk honest): not counted, listed as rejected', async () => {
      const { run, storage, viewKeys } = await scan('inflated-ecdh')
      const state = await run()
      expect(state.outputs).toEqual([])
      expect(totalReceived(state)).toBe(BigInt(0))
      expect(state.rejected).toEqual([
        { txHash: 'ab'.repeat(32), outputIndex: 0, height: 2_999_900, reason: 'commitment-mismatch' }
      ])
      // persisted, so a restart does not forget it
      expect(loadScanState(storage, Network.Mainnet, viewKeys.address)?.rejected).toHaveLength(1)
    })

    it('forged outPk (commits to another amount): not counted', async () => {
      const { run } = await scan('wrong-outpk')
      const state = await run()
      expect(totalReceived(state)).toBe(BigInt(0))
      expect(state.rejected[0].reason).toBe('commitment-mismatch')
    })

    it('missing outPk: not counted (and not silently counted as 0)', async () => {
      const { run } = await scan('missing-outpk')
      const state = await run()
      expect(state.outputs).toEqual([])
      expect(state.rejected).toEqual([expect.objectContaining({ reason: 'missing-commitment' })])
    })

    it('pre-RingCT / old format: not counted, reported as unsupported', async () => {
      const { run } = await scan('old-type')
      const state = await run()
      expect(state.outputs).toEqual([])
      expect(state.rejected).toEqual([expect.objectContaining({ reason: 'unsupported-tx-type' })])
    })

    it('the node serves the transaction to the scanner but withholds it for the check: the scan fails (nothing is credited, nothing is stored)', async () => {
      const { run, storage } = await scan(undefined, true)
      await expect(run()).rejects.toThrow(/did not return a transaction/)
      expect(
        loadScanState(storage, Network.Mainnet, deriveXmrViewKeys(PHRASE, Network.Mainnet).address)
      ).toBeUndefined()
    })
  })
})
