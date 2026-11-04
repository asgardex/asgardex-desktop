/**
 * View-only block scanner for Monero (public daemon, no light-wallet server).
 *
 * Built on `scanBlocks` of `@xchainjs/xchain-monero`, but with **view-only keys**: only the private view key and the
 * public spend key are passed. The private spend key is replaced by zeros, so
 * - owned outputs (and their amounts) are detected as usual,
 * - key images of owned outputs are meaningless -> **spent outputs are not detected**. The scanned "balance" is the
 *   total received since the start height. Spends made with the exported keys elsewhere are not reflected.
 *
 * Scan window
 * -----------
 * - The scan state is persisted per network + address (`asgardex-xmr-scan:*`), the start height advances after each
 *   successfully scanned chunk, so a restart continues at the last scanned height (minus a small reorg overlap) instead
 *   of re-scanning the same window. On first use the start is `tip - 720` (~1 day) unless a restore height is set.
 * - A single scan covers at most `XMR_MAX_SCAN_BLOCKS` (5,000, ~1 week) blocks, to bound the load on public daemons.
 *   A bigger gap raises `XmrScanRangeError` (nothing is skipped silently); the UI explains how to fix it
 *   (more recent restore height, or opt-in light-wallet server).
 * - `scanBlocks` swallows daemon errors (it only logs them). A failed chunk is detected via these log lines and
 *   treated as failure: the stored height is **not** advanced past blocks which could not be read.
 */
import { Network } from '@xchainjs/xchain-client'
import { scanBlocks } from '@xchainjs/xchain-monero'

import { observableState } from '../../helpers/stateHelper'
import { fetchDaemonHeight, KeyValueStorage } from './config'
import { XmrViewKeys } from './derivation'

export const XMR_MAX_SCAN_BLOCKS = 5000
/** Blocks per persisted step */
export const XMR_SCAN_CHUNK_BLOCKS = 1000
/** Blocks stepped back before the stored height to survive small reorgs */
export const XMR_REORG_OVERLAP_BLOCKS = 10
/** Blocks to step back from the tip on first use (~1 day) */
export const XMR_FIRST_USE_MARGIN = 720

export const XMR_SCAN_STORAGE_PREFIX = 'asgardex-xmr-scan:v1'

export type XmrOwnedOutput = {
  txHash: string
  outputIndex: number
  /** piconero */
  amount: bigint
  height: number
  /** unix seconds */
  timestamp: number
}

type StoredOutput = Omit<XmrOwnedOutput, 'amount'> & { amount: string }
type StoredScan = { startHeight: number; lastHeight: number; outputs: StoredOutput[] }

export type XmrScanState = { startHeight: number; lastHeight: number; outputs: XmrOwnedOutput[] }

/** Raised when the gap to scan is bigger than `XMR_MAX_SCAN_BLOCKS` */
export class XmrScanRangeError extends Error {
  readonly gap: number
  readonly fromHeight: number
  readonly tipHeight: number
  readonly limit: number
  constructor({ gap, fromHeight, tipHeight }: { gap: number; fromHeight: number; tipHeight: number }) {
    super(
      `Monero scan range too large: ${gap} blocks to scan from height ${fromHeight} (limit ${XMR_MAX_SCAN_BLOCKS}). ` +
        `Set a more recent restore height in the Monero wallet settings, or use a light-wallet server.`
    )
    this.name = 'XmrScanRangeError'
    this.gap = gap
    this.fromHeight = fromHeight
    this.tipHeight = tipHeight
    this.limit = XMR_MAX_SCAN_BLOCKS
  }
}

export type XmrScanStatus =
  { kind: 'idle' } | { kind: 'range-too-large'; gap: number; limit: number; fromHeight: number; tipHeight: number }

const { get$: xmrScanStatus$, set: setXmrScanStatus } = observableState<XmrScanStatus>({ kind: 'idle' })
export { xmrScanStatus$ }

export type ScanDeps = {
  getTip: (daemonUrl: string) => Promise<number>
  scanBlocks: typeof scanBlocks
}

const defaultDeps: ScanDeps = { getTip: fetchDaemonHeight, scanBlocks }

export const scanStorageKey = (network: Network, address: string) => `${XMR_SCAN_STORAGE_PREFIX}:${network}:${address}`

const isHeight = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

const parseStored = (raw: string | null): XmrScanState | undefined => {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Partial<StoredScan>
    if (!isHeight(parsed.startHeight) || typeof parsed.lastHeight !== 'number' || !Array.isArray(parsed.outputs)) {
      return undefined
    }
    const outputs: XmrOwnedOutput[] = []
    for (const o of parsed.outputs) {
      if (
        typeof o?.txHash !== 'string' ||
        !isHeight(o.outputIndex) ||
        !isHeight(o.height) ||
        typeof o.timestamp !== 'number' ||
        typeof o.amount !== 'string' ||
        !/^\d+$/.test(o.amount)
      ) {
        return undefined
      }
      outputs.push({
        txHash: o.txHash,
        outputIndex: o.outputIndex,
        amount: BigInt(o.amount),
        height: o.height,
        timestamp: o.timestamp
      })
    }
    return { startHeight: parsed.startHeight, lastHeight: parsed.lastHeight, outputs }
  } catch {
    return undefined
  }
}

export const loadScanState = (
  storage: KeyValueStorage | undefined,
  network: Network,
  address: string
): XmrScanState | undefined => {
  try {
    return parseStored(storage?.getItem(scanStorageKey(network, address)) ?? null)
  } catch {
    return undefined
  }
}

const saveScanState = (storage: KeyValueStorage | undefined, network: Network, address: string, s: XmrScanState) => {
  try {
    const stored: StoredScan = {
      startHeight: s.startHeight,
      lastHeight: s.lastHeight,
      outputs: s.outputs.map((o) => ({ ...o, amount: o.amount.toString() }))
    }
    storage?.setItem(scanStorageKey(network, address), JSON.stringify(stored))
  } catch {
    // storage full / unavailable: the scan state stays in memory for this session only
  }
}

const outputKey = (o: Pick<XmrOwnedOutput, 'txHash' | 'outputIndex'>) => `${o.txHash}:${o.outputIndex}`

/** One scan at a time (the scanner is detected via a console hook, see `scanChunk`) */
let scanLock: Promise<unknown> = Promise.resolve()

const SCANNER_LOG_PREFIX = '[XMR scanner]'

/* eslint-disable no-console -- scanBlocks of the SDK reports failures only via console.*; intercepted (not forwarded) on purpose */
/**
 * Runs `scanBlocks` for a chunk and reports whether it logged read failures (`scanBlocks` swallows them).
 */
const scanChunk = async ({
  deps,
  daemonUrl,
  viewKeys,
  from,
  to
}: {
  deps: ScanDeps
  daemonUrl: string
  viewKeys: XmrViewKeys
  from: number
  to: number
}): Promise<{ outputs: XmrOwnedOutput[]; failed: boolean }> => {
  let failed = false
  const origError = console.error
  const origWarn = console.warn
  const hook =
    (orig: typeof console.error) =>
    (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith(SCANNER_LOG_PREFIX) && /fail/i.test(args[0])) {
        failed = true
        return // not forwarded: it can contain node details
      }
      orig(...args)
    }
  console.error = hook(origError)
  console.warn = hook(origWarn)
  try {
    // Zero "spend key": view-only scanning (see header)
    const result = await deps.scanBlocks(
      daemonUrl,
      viewKeys.privateViewKey,
      viewKeys.publicSpendKey,
      new Uint8Array(32),
      from,
      to
    )
    return {
      failed,
      outputs: result.ownedOutputs.map((o) => ({
        txHash: o.txHash,
        outputIndex: o.outputIndex,
        amount: o.amount,
        height: o.height,
        timestamp: o.timestamp
      }))
    }
  } finally {
    console.error = origError
    console.warn = origWarn
  }
}
/* eslint-enable no-console */

/**
 * Brings the persisted scan state of `viewKeys.address` up to the daemon tip and returns it.
 *
 * @param restoreHeight explicit restore height of the settings (`null` = auto)
 */
export const scanXmrWallet = ({
  viewKeys,
  daemonUrl,
  restoreHeight,
  storage,
  deps = defaultDeps
}: {
  viewKeys: XmrViewKeys
  daemonUrl: string
  restoreHeight: number | null
  storage: KeyValueStorage | undefined
  deps?: ScanDeps
}): Promise<XmrScanState> => {
  const run = async (): Promise<XmrScanState> => {
    const { network, address } = viewKeys
    const tip = await deps.getTip(daemonUrl) // block count -> last block is `tip - 1`
    const lastBlock = tip - 1

    let state = loadScanState(storage, network, address)
    // A different explicit restore height than the one the stored state started with -> start over from it
    if (state && restoreHeight !== null && state.startHeight !== restoreHeight) state = undefined
    if (!state) {
      const startHeight = restoreHeight ?? Math.max(0, tip - XMR_FIRST_USE_MARGIN)
      state = { startHeight, lastHeight: startHeight - 1, outputs: [] }
      // Remember the start right away: a failed first scan must not move the window to a newer tip on retry
      saveScanState(storage, network, address, state)
    }

    const firstUnscanned = state.lastHeight + 1
    const gap = lastBlock - firstUnscanned + 1
    if (gap > XMR_MAX_SCAN_BLOCKS) {
      const error = new XmrScanRangeError({ gap, fromHeight: firstUnscanned, tipHeight: tip })
      setXmrScanStatus({
        kind: 'range-too-large',
        gap,
        limit: XMR_MAX_SCAN_BLOCKS,
        fromHeight: firstUnscanned,
        tipHeight: tip
      })
      throw error
    }

    let current = state
    // overlap with the last scanned blocks (reorgs); never before the start height
    let from = Math.max(current.startHeight, firstUnscanned - XMR_REORG_OVERLAP_BLOCKS)
    while (from <= lastBlock) {
      const to = Math.min(from + XMR_SCAN_CHUNK_BLOCKS - 1, lastBlock)
      const { outputs, failed } = await scanChunk({ deps, daemonUrl, viewKeys, from, to })
      if (failed) {
        throw new Error('The Monero node did not return all requested blocks. Try again later or use another node.')
      }
      // drop what we knew about the re-scanned range, then add the fresh result (dedupe)
      const kept = current.outputs.filter((o) => o.height < from)
      const seen = new Set(kept.map(outputKey))
      const fresh = outputs.filter((o) => !seen.has(outputKey(o)))
      current = { startHeight: current.startHeight, lastHeight: to, outputs: [...kept, ...fresh] }
      saveScanState(storage, network, address, current)
      from = to + 1
    }
    setXmrScanStatus({ kind: 'idle' })
    return current
  }

  const result = scanLock.then(run, run)
  scanLock = result.catch(() => undefined)
  return result
}

/** Received total (piconero) of a scan state. Spent outputs are not detectable (view-only). */
export const totalReceived = (state: XmrScanState): bigint =>
  state.outputs.reduce((acc, o) => acc + o.amount, BigInt(0))
