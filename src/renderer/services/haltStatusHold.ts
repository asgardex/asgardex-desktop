import { HoldLastKnownOptions } from '../helpers/rx/holdLastKnown'
import { ResetKey } from '../helpers/rx/resetKey'
import { getCurrentNetworkState, network$ } from './app/service'

const MINUTE = 60 * 1000

/**
 * All held halt inputs are keyed by network: on a mainnet/stagenet switch nothing of the previous network
 * (mimir, lastblock, max height, inbound_addresses) carries over, the status is Pending -> unknown after 15s.
 */
export const HALT_NETWORK_KEY: ResetKey = { get: getCurrentNetworkState, changes$: network$ }

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
  pendingTimeoutMs: 15 * 1000,
  resetKey: HALT_NETWORK_KEY
}

export const LASTBLOCK_HOLD: HoldLastKnownOptions = {
  maxAgeMs: 10 * MINUTE,
  maxFailures: 2,
  pendingTimeoutMs: 15 * 1000,
  resetKey: HALT_NETWORK_KEY
}

/**
 * THORChain (~6s) and MAYAChain (~5s) produce ~50-60 blocks in 5 min. A `lastblock` height that has not
 * advanced for that long means a stuck node or a cached response, not a live chain -> halt status unknown.
 */
export const LASTBLOCK_STALL_MS = 5 * MINUTE

/**
 * `inbound_addresses` (halted chains): a first load still pending after 15s is unknown (banner),
 * the same as mimir and lastblock. A failure is published right away (`maxFailures: 0`): a failed
 * list already counts as unknown (`resolveHaltState`), so it must not be hidden behind a held value.
 * `maxAgeMs: 15 min` (3 missed polls every 5 min): a list that was not refreshed, e.g. because reloads keep
 * hanging, is no longer trusted. The requests themselves time out after `HALT_REQUEST_TIMEOUT_MS`.
 */
export const INBOUND_HOLD: HoldLastKnownOptions = {
  maxAgeMs: 15 * MINUTE,
  maxFailures: 0,
  pendingTimeoutMs: 15 * 1000,
  resetKey: HALT_NETWORK_KEY
}
