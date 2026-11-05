/**
 * Monotonic milliseconds for freshness / timeout decisions (halt status).
 * `Date.now()` follows the wall clock, which can jump (NTP sync, manual change, sleep / resume),
 * so a backwards jump could keep a stale halt status "fresh". `performance.now()` never goes back.
 */
export const monotonicNow = (): number => performance.now()
