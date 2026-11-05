import { HoldLastKnownOptions } from '../helpers/rx/holdLastKnown'

const MINUTE = 60 * 1000

/**
 * How long halt inputs are trusted, tuned to their poll intervals
 * (mimir every 5 min, lastblock every 60s) and to the 12s request timeout.
 *
 * - `maxFailures: 2` -> one or two failed polls keep the last known value, the third makes the status unknown
 * - `pendingTimeoutMs` -> a first load that takes longer than this is shown as unknown (banner)
 * - `maxAgeMs` -> a value that was not refreshed for that long is no longer trusted
 *   (3 missed mimir polls / 10 missed lastblock polls)
 */
export const MIMIR_HOLD: HoldLastKnownOptions = {
  maxAgeMs: 15 * MINUTE,
  maxFailures: 2,
  pendingTimeoutMs: 15 * 1000
}

export const LASTBLOCK_HOLD: HoldLastKnownOptions = {
  maxAgeMs: 10 * MINUTE,
  maxFailures: 2,
  pendingTimeoutMs: 15 * 1000
}

/**
 * THORChain (~6s) and MAYAChain (~5s) produce ~50-60 blocks in 5 min. A `lastblock` height that has not
 * advanced for that long means a stuck node or a cached response, not a live chain -> halt status unknown.
 */
export const LASTBLOCK_STALL_MS = 5 * MINUTE
