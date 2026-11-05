/**
 * What this app relies on in `@xchainjs/xchain-monero` (pinned to exactly 0.2.9). When the SDK is upgraded these tests
 * must be re-read together with `scanner.ts` / `commitment.ts` and `xchainjs-monero-commitment.md`.
 */
import { ed25519 } from '@noble/curves/ed25519'
import { Network } from '@xchainjs/xchain-client'
import { defaultXMRParams, scanBlocks } from '@xchainjs/xchain-monero'

import sdkPackage from '../../../../node_modules/@xchainjs/xchain-monero/package.json?raw'
import appPackage from '../../../../package.json?raw'
import { DEFAULT_XMR_CONNECTION_CONFIG, getDaemonUrl } from './config'
import { bytesToHex, deriveXmrViewKeys } from './derivation'
import { buildPaymentTx, createFakeDaemon } from './fakeDaemon.testHelper'
import { scanXmrWallet, defaultScanDeps, mainnetTimeOfHeight } from './scanner'

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
const leBig = (b: Uint8Array): bigint => b.reduceRight((acc, v) => (acc << BigInt(8)) | BigInt(v), BigInt(0))
const publicViewKeyHex = bytesToHex(ed25519.ExtendedPoint.BASE.multiply(leBig(viewKeys.privateViewKey)).toRawBytes())
const payment = () => buildPaymentTx({ viewKeys, publicViewKeyHex, amount: BigInt(5) })

describe('@xchainjs/xchain-monero contract', () => {
  describe('version pin (L5)', () => {
    it('package.json pins exactly 0.2.9 (no ^ or ~ range)', () => {
      const deps = JSON.parse(appPackage).dependencies as Record<string, string>
      expect(deps['@xchainjs/xchain-monero']).toBe('0.2.9')
    })

    it('0.2.9 is what is installed', () => {
      expect(JSON.parse(sdkPackage).version).toBe('0.2.9')
    })
  })

  describe('the console output the failure detection depends on (scanner.ts: SCANNER_LOG_PREFIX)', () => {
    // scanBlocks swallows daemon errors and only logs them: scanner.ts treats a log line which starts with
    // "[XMR scanner]" and contains "fail" as a failed chunk. If an SDK update changes these lines, the scan would
    // silently report "nothing found" for unreadable blocks, so these tests have to fail first.
    const stages = [
      ['get_block_headers_range', 'getBlockHeadersRange failed'],
      ['get_block', 'getBlockTxHashes failed'],
      ['get_transactions', 'getTransactionsDecoded failed']
    ] as const

    it.each(stages)('real scanBlocks logs a "[XMR scanner] … failed" line when %s fails', async (failRequest, text) => {
      const daemon = createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_990, tx: payment(), failRequest })
      vi.stubGlobal('fetch', daemon.fetch)
      const errors: unknown[][] = []
      vi.spyOn(console, 'error').mockImplementation((...a) => void errors.push(a))
      vi.spyOn(console, 'warn').mockImplementation((...a) => void errors.push(a))
      vi.spyOn(console, 'log').mockImplementation(() => undefined)
      try {
        // the contract: it resolves (swallowing the error) and only logs
        await scanBlocks(
          'https://node.example',
          viewKeys.privateViewKey,
          viewKeys.publicSpendKey,
          new Uint8Array(32),
          2_999_980,
          2_999_999
        )
      } finally {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
      }
      const lines = errors.map((a) => String(a[0]))
      const line = lines.find((l) => l.includes(text))
      expect(line, `no "${text}" line in ${JSON.stringify(lines)}`).toBeDefined()
      expect(line!.startsWith('[XMR scanner]')).toBe(true)
      expect(/fail/i.test(line!)).toBe(true)
    })

    it.each(stages)('scanXmrWallet fails (and stores nothing) when %s fails', async (failRequest) => {
      const daemon = createFakeDaemon({ tip: 3_000_000, txHeight: 2_999_900, tx: payment(), failRequest })
      vi.stubGlobal('fetch', daemon.fetch)
      vi.spyOn(console, 'log').mockImplementation(() => undefined)
      const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const data: Record<string, string> = {}
      try {
        await expect(
          scanXmrWallet({
            viewKeys,
            daemonUrl: 'https://node.example',
            restoreHeight: null,
            storage: { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) },
            deps: { ...defaultScanDeps, now: () => mainnetTimeOfHeight(3_000_000) }
          })
        ).rejects.toThrow()
        expect(Object.keys(data)).toEqual([])
        // intercepted lines are not forwarded (they can contain node details)
        expect([...err.mock.calls, ...warn.mock.calls].filter(([m]) => String(m).startsWith('[XMR scanner]'))).toEqual(
          []
        )
      } finally {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
      }
    })
  })

  describe('network defaults (L5)', () => {
    const urls = defaultXMRParams.daemonUrls as Record<string, string[]>

    it('mainnet resolves to a mainnet https daemon, never to the stagenet / testnet default', () => {
      const mainnet = getDaemonUrl(DEFAULT_XMR_CONNECTION_CONFIG, Network.Mainnet)!
      expect(mainnet).toBe(urls[Network.Mainnet][0])
      expect(mainnet.startsWith('https://')).toBe(true)
      for (const other of [...urls[Network.Stagenet], ...urls[Network.Testnet]]) {
        expect(mainnet).not.toBe(other)
        expect(urls[Network.Mainnet]).not.toContain(other)
      }
    })

    it('stagenet / testnet get the (plain http) stagenet daemon, mainnet does not', () => {
      expect(getDaemonUrl(DEFAULT_XMR_CONNECTION_CONFIG, Network.Stagenet)).toBe(urls[Network.Stagenet][0])
      expect(getDaemonUrl(DEFAULT_XMR_CONNECTION_CONFIG, Network.Testnet)).toBe(urls[Network.Testnet][0])
      expect(getDaemonUrl(DEFAULT_XMR_CONNECTION_CONFIG, Network.Stagenet)!.startsWith('http://')).toBe(true)
    })

    it('no mainnet default is a plain http URL', () => {
      for (const url of urls[Network.Mainnet]) expect(url.startsWith('https://')).toBe(true)
    })
  })
})
