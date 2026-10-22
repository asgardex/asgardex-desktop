/**
 * Poll every 6s, about one THORChain block. Pool prices cannot change faster,
 * and a shorter interval only adds THORNode load.
 */
export const POLL_INTERVAL_MS = 6_000

/**
 * A hung THORNode request must not block the asset forever. 10s is longer than one poll (6s),
 * so a slow answer still lands, and short enough that the next poll retries soon after.
 */
export const FETCH_TIMEOUT_MS = 10_000

export const RUNE_ASSET_KEY = 'THOR.RUNE'

/** RUNE has no pool of its own, so it is priced against this deep pool. */
export const RUNE_REFERENCE_POOL = 'BTC.BTC'
