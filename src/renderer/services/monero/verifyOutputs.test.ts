import { ed25519 } from '@noble/curves/ed25519'
import { Network } from '@xchainjs/xchain-client'

import { bytesToHex, deriveXmrViewKeys } from './derivation'
import { buildPaymentTx } from './fakeDaemon.testHelper'
import { DaemonTx, fetchDaemonTransactions, UnverifiedXmrOutput, verifyOwnedOutputs } from './verifyOutputs'

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
const leBig = (b: Uint8Array): bigint => b.reduceRight((acc, v) => (acc << BigInt(8)) | BigInt(v), BigInt(0))
const publicViewKeyHex = bytesToHex(ed25519.ExtendedPoint.BASE.multiply(leBig(viewKeys.privateViewKey)).toRawBytes())
const AMOUNT = BigInt(42_000_000_000)

const tx = buildPaymentTx({ viewKeys, publicViewKeyHex, amount: AMOUNT })
const txPubKey = Uint8Array.from(tx.extra.slice(1, 33))
const output = (txHash: string, amount = AMOUNT): UnverifiedXmrOutput => ({
  txHash,
  outputIndex: 0,
  amount,
  height: 10,
  timestamp: 1,
  txPubKey
})
const serve =
  (txs: Record<string, unknown>) =>
  (_url: string, hashes: string[]): Promise<DaemonTx[]> =>
    Promise.resolve(
      hashes.filter((h) => h in txs).map((h) => ({ tx_hash: h, as_json: JSON.stringify(txs[h]) }) as DaemonTx)
    )

describe('services/monero/verifyOutputs', () => {
  it('returns verified outputs without the tx public key', async () => {
    const { verified, rejected } = await verifyOwnedOutputs({
      daemonUrl: 'https://n',
      viewKeys,
      outputs: [output('aa')],
      fetchTransactions: serve({ aa: tx })
    })
    expect(rejected).toEqual([])
    expect(verified).toEqual([{ txHash: 'aa', outputIndex: 0, amount: AMOUNT, height: 10, timestamp: 1 }])
  })

  it('an amount which differs from the one we decrypted ourselves is rejected (amount-mismatch)', async () => {
    const { verified, rejected } = await verifyOwnedOutputs({
      daemonUrl: 'https://n',
      viewKeys,
      outputs: [output('aa', AMOUNT * BigInt(2))],
      fetchTransactions: serve({ aa: tx })
    })
    expect(verified).toEqual([])
    expect(rejected).toEqual([{ txHash: 'aa', outputIndex: 0, height: 10, reason: 'amount-mismatch' }])
  })

  it('a transaction the node does not return fails (never credited, never skipped)', async () => {
    await expect(
      verifyOwnedOutputs({
        daemonUrl: 'https://n',
        viewKeys,
        outputs: [output('aa'), output('bb')],
        fetchTransactions: serve({ aa: tx })
      })
    ).rejects.toThrow(/did not return a transaction/)
  })

  it('unreadable transaction JSON fails', async () => {
    await expect(
      verifyOwnedOutputs({
        daemonUrl: 'https://n',
        viewKeys,
        outputs: [output('aa')],
        fetchTransactions: () => Promise.resolve([{ tx_hash: 'aa', as_json: '{nope' }])
      })
    ).rejects.toThrow(/unreadable/)
  })

  it('ignores transactions which were not asked for', async () => {
    await expect(
      verifyOwnedOutputs({
        daemonUrl: 'https://n',
        viewKeys,
        outputs: [output('aa')],
        fetchTransactions: () => Promise.resolve([{ tx_hash: 'zz', as_json: JSON.stringify(tx) }])
      })
    ).rejects.toThrow(/did not return a transaction/)
  })

  it('asks for each transaction once, in batches of 25', async () => {
    const hashes = Array.from({ length: 60 }, (_, i) => `h${i}`)
    const fetchTransactions = vi.fn(serve(Object.fromEntries(hashes.map((h) => [h, tx]))))
    const outputs = [...hashes, 'h0', 'h1'].map((h) => output(h))
    const { verified } = await verifyOwnedOutputs({ daemonUrl: 'https://n', viewKeys, outputs, fetchTransactions })
    expect(verified).toHaveLength(62)
    expect(fetchTransactions.mock.calls.map(([, batch]) => batch.length)).toEqual([25, 25, 10])
  })

  it('no outputs: no request', async () => {
    const fetchTransactions = vi.fn()
    await verifyOwnedOutputs({ daemonUrl: 'https://n', viewKeys, outputs: [], fetchTransactions })
    expect(fetchTransactions).not.toHaveBeenCalled()
  })

  describe('fetchDaemonTransactions', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('POSTs get_transactions with redirect: "error"', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ txs: [{ tx_hash: 'aa' }] }) })
      vi.stubGlobal('fetch', fetchFn)
      await expect(fetchDaemonTransactions('https://n', ['aa'])).resolves.toEqual([{ tx_hash: 'aa' }])
      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('https://n/get_transactions')
      expect(init.redirect).toBe('error')
      expect(JSON.parse(init.body)).toEqual({ txs_hashes: ['aa'], decode_as_json: true })
    })

    it('HTTP errors throw; a missing txs array is an empty list', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))
      await expect(fetchDaemonTransactions('https://n', ['aa'])).rejects.toThrow()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
      await expect(fetchDaemonTransactions('https://n', ['aa'])).resolves.toEqual([])
    })
  })
})
