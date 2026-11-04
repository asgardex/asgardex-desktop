/* eslint-disable no-console -- tests the console interception of the scanner */
import { Network } from '@xchainjs/xchain-client'
import { firstValueFrom } from 'rxjs'

import { KeyValueStorage } from './config'
import { deriveXmrViewKeys } from './derivation'
import {
  loadScanState,
  scanStorageKey,
  scanXmrWallet,
  ScanDeps,
  totalReceived,
  xmrScanStatus$,
  XmrScanRangeError,
  XMR_FIRST_USE_MARGIN,
  XMR_MAX_SCAN_BLOCKS,
  XMR_REORG_OVERLAP_BLOCKS,
  XMR_SCAN_CHUNK_BLOCKS
} from './scanner'

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
const DAEMON = 'https://node.example'

const memoryStorage = (): KeyValueStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {}
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v
    }
  }
}

type Output = { txHash: string; outputIndex: number; amount: bigint; height: number; timestamp: number }
const out = (txHash: string, height: number, amount = BigInt(1_000_000_000_000), outputIndex = 0): Output => ({
  txHash,
  outputIndex,
  amount,
  height,
  timestamp: 1_700_000_000 + height
})

/** Fake `scanBlocks`: returns the `outputs` which lie in the requested range, records the ranges */
const fakeDeps = (tip: number, outputs: Output[] = []) => {
  const ranges: Array<[number, number]> = []
  const spendKeys: Uint8Array[] = []
  const state = { tip }
  const deps: ScanDeps = {
    getTip: vi.fn(() => Promise.resolve(state.tip)),

    scanBlocks: vi.fn(
      async (_url: string, _a: Uint8Array, _B: Uint8Array, spend: Uint8Array, from: number, to: number) => {
        ranges.push([from, to])
        spendKeys.push(spend)
        return {
          ownedOutputs: outputs
            .filter((o) => o.height >= from && o.height <= to)
            .map((o) => ({
              ...o,
              globalIndex: -1,
              publicKey: new Uint8Array(32),
              txPubKey: new Uint8Array(32),
              keyImage: 'ki'
            })),
          spentKeyImages: new Set<string>()
        }
      }
    ) as unknown as ScanDeps['scanBlocks']
  }
  return { deps, ranges, spendKeys, state }
}

const run = (storage: KeyValueStorage, deps: ScanDeps, restoreHeight: number | null = null) =>
  scanXmrWallet({ viewKeys, daemonUrl: DAEMON, restoreHeight, storage, deps })

describe('services/monero/scanner', () => {
  describe('view-only scanning', () => {
    it('never passes a spend key to the scanner (zeros)', async () => {
      const { deps, spendKeys } = fakeDeps(1_000)
      await run(memoryStorage(), deps)
      expect(spendKeys.length).toBeGreaterThan(0)
      for (const key of spendKeys) expect(Array.from(key)).toEqual(new Array(32).fill(0))
    })
  })

  describe('start height / persistence', () => {
    it('first use: starts at tip - 720 and persists the state', async () => {
      const storage = memoryStorage()
      const { deps, ranges } = fakeDeps(3_000_000)
      const state = await run(storage, deps)
      expect(state.startHeight).toBe(3_000_000 - XMR_FIRST_USE_MARGIN)
      expect(ranges[0][0]).toBe(3_000_000 - XMR_FIRST_USE_MARGIN)
      expect(ranges[ranges.length - 1][1]).toBe(3_000_000 - 1)
      expect(loadScanState(storage, Network.Mainnet, viewKeys.address)?.lastHeight).toBe(3_000_000 - 1)
    })

    it('restart: continues after the stored height, does not rescan the same tip-720 window', async () => {
      const storage = memoryStorage()
      const first = fakeDeps(3_000_000)
      await run(storage, first.deps)

      // "restart" (new service call, same storage) 30 blocks later
      const second = fakeDeps(3_000_030)
      const state = await run(storage, second.deps)

      const scanned = second.ranges.reduce((n, [a, b]) => n + (b - a + 1), 0)
      expect(scanned).toBe(30 + XMR_REORG_OVERLAP_BLOCKS) // new blocks + small reorg overlap only
      expect(second.ranges[0][0]).toBe(3_000_000 - XMR_REORG_OVERLAP_BLOCKS)
      expect(state.lastHeight).toBe(3_000_030 - 1)
      expect(state.startHeight).toBe(3_000_000 - XMR_FIRST_USE_MARGIN) // unchanged
    })

    it('nothing new -> only the overlap is re-read, balance unchanged', async () => {
      const storage = memoryStorage()
      const outputs = [out('tx1', 2_999_900)]
      const a = fakeDeps(3_000_000, outputs)
      const s1 = await run(storage, a.deps)
      const b = fakeDeps(3_000_000, outputs)
      const s2 = await run(storage, b.deps)
      expect(totalReceived(s1)).toBe(totalReceived(s2))
      expect(b.ranges.reduce((n, [x, y]) => n + (y - x + 1), 0)).toBeLessThanOrEqual(XMR_REORG_OVERLAP_BLOCKS)
    })

    it('start height advances after each successful chunk (progress survives a later failure)', async () => {
      const storage = memoryStorage()
      const tip = 3_000_000
      const { deps } = fakeDeps(tip)
      await run(storage, deps) // initial window

      const next = fakeDeps(tip + 2_500)
      let call = 0
      const original = next.deps.scanBlocks
      next.deps.scanBlocks = vi.fn((...args: Parameters<ScanDeps['scanBlocks']>) => {
        call += 1
        if (call === 3) return Promise.reject(new Error('node went away'))
        return original(...args)
      }) as unknown as ScanDeps['scanBlocks']
      await expect(run(storage, next.deps)).rejects.toThrow('node went away')

      const saved = loadScanState(storage, Network.Mainnet, viewKeys.address)!
      // two chunks of the second run were stored; the failed third was not
      expect(saved.lastHeight).toBe(tip - XMR_REORG_OVERLAP_BLOCKS + 2 * XMR_SCAN_CHUNK_BLOCKS - 1)
    })

    it('keeps found outputs, dedupes re-scanned ones and sums them', async () => {
      const storage = memoryStorage()
      const outputs = [out('tx1', 2_999_995), out('tx2', 2_999_500, BigInt(5), 1)]
      const first = await run(storage, fakeDeps(3_000_000, outputs).deps)
      expect(totalReceived(first)).toBe(BigInt(1_000_000_000_005))
      // tx1 lies inside the overlap window and is seen again
      const second = await run(storage, fakeDeps(3_000_010, outputs).deps)
      expect(second.outputs).toHaveLength(2)
      expect(totalReceived(second)).toBe(BigInt(1_000_000_000_005))
    })

    it('state is stored per network + address', async () => {
      const storage = memoryStorage()
      await run(storage, fakeDeps(3_000_000).deps)
      expect(Object.keys(storage.data)).toEqual([scanStorageKey(Network.Mainnet, viewKeys.address)])
    })

    it('an explicit restore height starts there, and a changed one starts over', async () => {
      const storage = memoryStorage()
      const a = fakeDeps(3_000_000)
      const s1 = await run(storage, a.deps, 2_999_000)
      expect(s1.startHeight).toBe(2_999_000)

      const b = fakeDeps(3_000_000)
      const s2 = await run(storage, b.deps, 2_998_000)
      expect(s2.startHeight).toBe(2_998_000)
      expect(b.ranges[0][0]).toBe(2_998_000)
    })

    it('ignores corrupt stored state', async () => {
      const storage = memoryStorage()
      storage.setItem(scanStorageKey(Network.Mainnet, viewKeys.address), '{"startHeight":"x"}')
      const state = await run(storage, fakeDeps(3_000_000).deps)
      expect(state.startHeight).toBe(3_000_000 - XMR_FIRST_USE_MARGIN)
    })
  })

  describe('5,000 block limit (never fails silently)', () => {
    it('throws XmrScanRangeError with the numbers and publishes a UI status', async () => {
      const storage = memoryStorage()
      const tip = 3_000_000
      const gap = XMR_MAX_SCAN_BLOCKS + 1234
      const error = await run(storage, fakeDeps(tip).deps, tip - gap).catch((e) => e)
      expect(error).toBeInstanceOf(XmrScanRangeError)
      expect(error.gap).toBe(gap)
      expect(error.limit).toBe(XMR_MAX_SCAN_BLOCKS)
      expect(error.fromHeight).toBe(tip - gap)
      expect(error.message).toContain(String(gap))
      expect(error.message).toMatch(/restore height/i)
      expect(error.message).toMatch(/light-wallet server/i)

      expect(await firstValueFrom(xmrScanStatus$)).toEqual({
        kind: 'range-too-large',
        gap,
        limit: XMR_MAX_SCAN_BLOCKS,
        fromHeight: tip - gap,
        tipHeight: tip
      })
    })

    it('does not scan anything when the gap is too large', async () => {
      const { deps } = fakeDeps(3_000_000)
      await run(memoryStorage(), deps, 2_000_000).catch(() => undefined)
      expect(deps.scanBlocks).not.toHaveBeenCalled()
    })

    it('exactly the limit is fine; the status is reset after a successful scan', async () => {
      const tip = 3_000_000
      await run(memoryStorage(), fakeDeps(tip).deps, tip - XMR_MAX_SCAN_BLOCKS - 1).catch(() => undefined)
      expect((await firstValueFrom(xmrScanStatus$)).kind).toBe('range-too-large')

      const state = await run(memoryStorage(), fakeDeps(tip).deps, tip - XMR_MAX_SCAN_BLOCKS)
      expect(state.lastHeight).toBe(tip - 1)
      expect(await firstValueFrom(xmrScanStatus$)).toEqual({ kind: 'idle' })
    })

    it('a stored state which fell behind by more than the limit also raises the error (no silent skip)', async () => {
      const storage = memoryStorage()
      await run(storage, fakeDeps(3_000_000).deps)
      const error = await run(storage, fakeDeps(3_000_000 + XMR_MAX_SCAN_BLOCKS + 500).deps).catch((e) => e)
      expect(error).toBeInstanceOf(XmrScanRangeError)
      // state is untouched: a more recent restore height (or an LWS) can fix it
      expect(loadScanState(storage, Network.Mainnet, viewKeys.address)?.lastHeight).toBe(3_000_000 - 1)
    })
  })

  describe('unreadable blocks (scanBlocks only logs them)', () => {
    it('is treated as failure and the stored height does not advance', async () => {
      const storage = memoryStorage()
      await run(storage, fakeDeps(3_000_000).deps)
      const before = loadScanState(storage, Network.Mainnet, viewKeys.address)!

      const failing = fakeDeps(3_000_100)
      failing.deps.scanBlocks = vi.fn(async () => {
        console.error('[XMR scanner] getBlockHeadersRange failed for 3000000-3000099: boom')
        return { ownedOutputs: [], spentKeyImages: new Set<string>() }
      }) as unknown as ScanDeps['scanBlocks']

      await expect(run(storage, failing.deps)).rejects.toThrow(/did not return all requested blocks/)
      expect(loadScanState(storage, Network.Mainnet, viewKeys.address)?.lastHeight).toBe(before.lastHeight)
    })

    it('restores console.error / console.warn', async () => {
      const { error, warn } = console
      await run(memoryStorage(), fakeDeps(3_000_000).deps)
      expect(console.error).toBe(error)
      expect(console.warn).toBe(warn)
    })
  })

  it('serialises concurrent scans', async () => {
    const storage = memoryStorage()
    const { deps } = fakeDeps(3_000_000)
    const [a, b] = await Promise.all([run(storage, deps), run(storage, deps)])
    expect(a.lastHeight).toBe(b.lastHeight)
  })
})
