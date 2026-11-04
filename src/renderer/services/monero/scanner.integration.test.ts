import { Network } from '@xchainjs/xchain-client'

import { KeyValueStorage } from './config'
import { deriveXmrExportKeys, deriveXmrViewKeys } from './derivation'
import { buildPaymentTx, createFakeDaemon } from './fakeDaemon.testHelper'
import { scanXmrWallet, totalReceived } from './scanner'

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const AMOUNT = BigInt(2_500_000_000_000)

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
      storage
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

    // a restart keeps the balance without rescanning the window
    const requestsBefore = daemon.requests().length
    daemon.setTip(3_000_005)
    const again = await scanXmrWallet({ viewKeys, daemonUrl: 'https://node.example', restoreHeight: null, storage })
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
      storage: memoryStorage()
    })
    expect(state.outputs).toHaveLength(0)
  })
})
