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
 *
 * Amount verification
 * -------------------
 * `scanBlocks` decrypts amounts but never checks them against the output commitment. Every output it finds is
 * verified in the app (`commitment.ts`, `verifyOutputs.ts`: `C == mask·G + amount·H`) before it is counted. Outputs which
 * fail, have no commitment, or are not supported (coinbase / pre-RingCT) are kept as `rejected` (shown in the UI), never
 * counted as 0.
 *
 * Start height and node trust
 * ---------------------------
 * The start height (derived from the node's tip on first use) is only persisted together with the first successfully
 * scanned (and verified) chunk. The node's tip is sanity-checked before it is used: mainnet heights must be near the
 * height expected from the time (`expectedMainnetHeight`), and a stored scan must not jump back or ahead faster than
 * the chain can grow. A second daemon is not consulted (documented in MONERO.md).
 * All daemon requests use `redirect: 'error'`.
 */
import { Network } from '@xchainjs/xchain-client'
import { scanBlocks } from '@xchainjs/xchain-monero'

import { observableState } from '../../helpers/stateHelper'
import { fetchDaemonHeight, KeyValueStorage } from './config'
import { XmrViewKeys } from './derivation'
import { verifyOwnedOutputs, UnverifiedXmrOutput, VerifiedXmrOutput, XmrRejectedOutput } from './verifyOutputs'

export type { XmrRejectedOutput }

export const XMR_MAX_SCAN_BLOCKS = 5000
/** Blocks per persisted step */
export const XMR_SCAN_CHUNK_BLOCKS = 1000
/** Blocks stepped back before the stored height to survive small reorgs */
export const XMR_REORG_OVERLAP_BLOCKS = 10
/** Blocks to step back from the tip on first use (~1 day) */
export const XMR_FIRST_USE_MARGIN = 720

/** v2: cached outputs are amount-verified (v1 caches held unverified amounts and are ignored) */
export const XMR_SCAN_STORAGE_PREFIX = 'asgardex-xmr-scan:v2'

/** Mainnet RingCT v2 fork (2 minute blocks) as reference for the height plausibility check */
const MAINNET_REF_HEIGHT = 1_009_827
const MAINNET_REF_TIME_MS = Date.UTC(2016, 2, 22)
const MAINNET_BLOCK_TIME_MS = 120_000
/** The expected mainnet height may be off by this much (blocks are only 2 minutes on average) */
const MAINNET_HEIGHT_TOLERANCE = 0.03
/** A stored scan may go back this far (reorgs) when the node reports a lower tip */
export const XMR_TIP_REORG_TOLERANCE = 100
/** Faster-than-expected growth allowed since the last scan (factor) plus a constant (blocks) */
const TIP_GROWTH_FACTOR = 2
const TIP_GROWTH_SLACK = 2000

/** Height mainnet is expected to have at `nowMs` (approximate) */
export const expectedMainnetHeight = (nowMs: number): number =>
  MAINNET_REF_HEIGHT + Math.floor((nowMs - MAINNET_REF_TIME_MS) / MAINNET_BLOCK_TIME_MS)

/** Time at which mainnet is expected to have `height` (inverse of `expectedMainnetHeight`; for tests) */
export const mainnetTimeOfHeight = (height: number): number =>
  MAINNET_REF_TIME_MS + (height - MAINNET_REF_HEIGHT) * MAINNET_BLOCK_TIME_MS

/** An output whose amount was verified against its commitment */
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
type StoredScan = {
  startHeight: number
  lastHeight: number
  outputs: StoredOutput[]
  rejected?: XmrRejectedOutput[]
  updatedAt?: number
}

export type XmrScanState = {
  startHeight: number
  lastHeight: number
  outputs: XmrOwnedOutput[]
  /** Outputs of this wallet which were NOT counted (failed verification / unsupported) */
  rejected: XmrRejectedOutput[]
  /** ms since epoch of the last successful scan step (for the tip plausibility check) */
  updatedAt?: number
}

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

/** Outputs of the current wallet which were not counted (see `XmrScanState.rejected`) */
const { get$: xmrRejectedCount$, set: setXmrRejectedCount } = observableState<number>(0)
export { xmrRejectedCount$ }

export type ScanDeps = {
  getTip: (daemonUrl: string) => Promise<number>
  scanBlocks: typeof scanBlocks
  /** Checks the amounts of found outputs against their commitments */
  verifyOutputs: (args: {
    daemonUrl: string
    viewKeys: XmrViewKeys
    outputs: UnverifiedXmrOutput[]
  }) => Promise<{ verified: VerifiedXmrOutput[]; rejected: XmrRejectedOutput[] }>
  /** ms since epoch (for the tip plausibility check) */
  now: () => number
}

export const defaultScanDeps: ScanDeps = {
  getTip: fetchDaemonHeight,
  scanBlocks,
  verifyOutputs: verifyOwnedOutputs,
  now: () => Date.now()
}
const defaultDeps = defaultScanDeps

export class XmrImplausibleTipError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XmrImplausibleTipError'
  }
}

/** Start heights chosen in this session whose first scan did not succeed yet (never persisted before a success) */
const pendingStarts = new Map<string, number>()

/**
 * Rejects tips a node could use to move the scan window somewhere useless (or to hide payments):
 * - mainnet: must be within `MAINNET_HEIGHT_TOLERANCE` of the height expected from the time
 * - with a stored scan: not further back than the reorg tolerance, and not further ahead than the chain can have grown
 */
const assertPlausibleTip = ({
  network,
  tip,
  state,
  nowMs
}: {
  network: Network
  tip: number
  state: XmrScanState | undefined
  nowMs: number
}) => {
  if (!Number.isInteger(tip) || tip <= 0) throw new XmrImplausibleTipError('The Monero node reported an invalid height')
  if (network === Network.Mainnet) {
    const expected = expectedMainnetHeight(nowMs)
    if (Math.abs(tip - expected) > expected * MAINNET_HEIGHT_TOLERANCE) {
      throw new XmrImplausibleTipError(
        'The Monero node reported an implausible block height. Try another node in the Monero wallet settings.'
      )
    }
  }
  if (state) {
    const lastBlock = tip - 1
    const elapsedBlocks = Math.max(0, nowMs - (state.updatedAt ?? nowMs)) / MAINNET_BLOCK_TIME_MS
    if (
      lastBlock < state.lastHeight - XMR_TIP_REORG_TOLERANCE ||
      lastBlock > state.lastHeight + elapsedBlocks * TIP_GROWTH_FACTOR + TIP_GROWTH_SLACK
    ) {
      throw new XmrImplausibleTipError(
        'The Monero node reported a block height which does not fit the last scan. Try another node in the Monero wallet settings.'
      )
    }
  }
}

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
    const rejected: XmrRejectedOutput[] = []
    for (const r of Array.isArray(parsed.rejected) ? parsed.rejected : []) {
      if (
        typeof r?.txHash !== 'string' ||
        !isHeight(r.outputIndex) ||
        !isHeight(r.height) ||
        typeof r.reason !== 'string'
      ) {
        return undefined
      }
      rejected.push({ txHash: r.txHash, outputIndex: r.outputIndex, height: r.height, reason: r.reason })
    }
    return {
      startHeight: parsed.startHeight,
      lastHeight: parsed.lastHeight,
      outputs,
      rejected,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined
    }
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
      outputs: s.outputs.map((o) => ({ ...o, amount: o.amount.toString() })),
      rejected: s.rejected,
      updatedAt: s.updatedAt
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

/**
 * Runs `fn` with a `fetch` which never follows redirects for requests to `daemonUrl` (the SDK scanner uses the global
 * `fetch` and sets no `redirect` option). Other requests are passed through unchanged. Scans run one at a time.
 */
const withNoRedirects = async <A>(daemonUrl: string, fn: () => Promise<A>): Promise<A> => {
  const original = globalThis.fetch
  const guarded = ((input: RequestInfo | URL, init?: RequestInit) =>
    original(
      input,
      typeof input === 'string' && input.startsWith(daemonUrl) ? { ...init, redirect: 'error' } : init
    )) as typeof fetch
  globalThis.fetch = guarded
  try {
    return await fn()
  } finally {
    globalThis.fetch = original
  }
}

/* eslint-disable no-console -- scanBlocks of the SDK reports failures only via console.*; intercepted (not forwarded) on purpose */
/**
 * Runs `scanBlocks` for a chunk and reports whether it logged read failures (`scanBlocks` swallows them).
 * Found outputs are amount-verified before they are returned.
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
}): Promise<{ verified: VerifiedXmrOutput[]; rejected: XmrRejectedOutput[]; failed: boolean }> => {
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
  let found: UnverifiedXmrOutput[]
  try {
    // Zero "spend key": view-only scanning (see header)
    const result = await withNoRedirects(daemonUrl, () =>
      deps.scanBlocks(daemonUrl, viewKeys.privateViewKey, viewKeys.publicSpendKey, new Uint8Array(32), from, to)
    )
    found = result.ownedOutputs.map((o) => ({
      txHash: o.txHash,
      outputIndex: o.outputIndex,
      amount: o.amount,
      height: o.height,
      timestamp: o.timestamp,
      txPubKey: o.txPubKey
    }))
  } finally {
    console.error = origError
    console.warn = origWarn
  }
  if (failed) return { verified: [], rejected: [], failed }
  const { verified, rejected } = await withNoRedirects(daemonUrl, () =>
    deps.verifyOutputs({ daemonUrl, viewKeys, outputs: found })
  )
  return { verified, rejected, failed }
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

    const stored = loadScanState(storage, network, address)
    assertPlausibleTip({ network, tip, state: stored, nowMs: deps.now() })

    let state = stored
    // A different explicit restore height than the one the stored state started with -> start over from it
    if (state && restoreHeight !== null && state.startHeight !== restoreHeight) state = undefined
    const pendingKey = `${network}:${address}`
    if (!state) {
      // Not persisted yet: only the first successfully scanned chunk stores it. Within this session a retry keeps
      // the same start (a failed first attempt must not move the window to a newer tip).
      const startHeight = restoreHeight ?? pendingStarts.get(pendingKey) ?? Math.max(0, tip - XMR_FIRST_USE_MARGIN)
      pendingStarts.set(pendingKey, startHeight)
      state = { startHeight, lastHeight: startHeight - 1, outputs: [], rejected: [] }
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
      const { verified, rejected, failed } = await scanChunk({ deps, daemonUrl, viewKeys, from, to })
      if (failed) {
        throw new Error('The Monero node did not return all requested blocks. Try again later or use another node.')
      }
      // drop what we knew about the re-scanned range, then add the fresh result (dedupe)
      const kept = current.outputs.filter((o) => o.height < from)
      const seen = new Set(kept.map(outputKey))
      const fresh = verified.filter((o) => !seen.has(outputKey(o)))
      const keptRejected = current.rejected.filter((o) => o.height < from)
      const seenRejected = new Set(keptRejected.map(outputKey))
      const freshRejected = rejected.filter((o) => !seenRejected.has(outputKey(o)))
      current = {
        startHeight: current.startHeight,
        lastHeight: to,
        outputs: [...kept, ...fresh],
        rejected: [...keptRejected, ...freshRejected],
        updatedAt: deps.now()
      }
      saveScanState(storage, network, address, current)
      pendingStarts.delete(pendingKey)
      from = to + 1
    }
    setXmrScanStatus({ kind: 'idle' })
    setXmrRejectedCount(current.rejected.length)
    return current
  }

  const result = scanLock.then(run, run)
  scanLock = result.catch(() => undefined)
  return result
}

/** Received total (piconero) of a scan state. Spent outputs are not detectable (view-only). */
export const totalReceived = (state: XmrScanState): bigint =>
  state.outputs.reduce((acc, o) => acc + o.amount, BigInt(0))
