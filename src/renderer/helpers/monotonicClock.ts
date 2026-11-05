/**
 * Monotonic milliseconds for freshness / timeout decisions (halt status).
 * `Date.now()` follows the wall clock, which can jump (NTP sync, manual change, sleep / resume),
 * so a backwards jump could keep a stale halt status "fresh". `performance.now()` never goes back.
 */
export const monotonicNow = (): number => performance.now()

/**
 * A clock for halt status age that fails closed: between two reads it advances by the *larger* of the
 * monotonic and the wall-clock elapsed time (never by less than 0).
 * - wall clock jumps back -> the monotonic time still counts (stale data does not look fresh)
 * - wall clock jumps forward, or a sleep the monotonic clock did not count -> the wall time counts,
 *   so the age grows and the status turns unknown rather than staying "fresh"
 * Each call creates an independent clock (one per stream subscription).
 */
export const createFailClosedClock = (
  mono: () => number = monotonicNow,
  wall: () => number = Date.now
): (() => number) => {
  let lastMono = mono()
  let lastWall = wall()
  let elapsed = 0
  return () => {
    const m = mono()
    const w = wall()
    elapsed += Math.max(m - lastMono, w - lastWall, 0)
    lastMono = m
    lastWall = w
    return elapsed
  }
}
