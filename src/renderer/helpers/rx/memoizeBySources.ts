/**
 * Caches the result of `create` per pair of source objects (e.g. two service streams), so every caller with the
 * same sources gets the same instance. Used for halt-status streams: their freshness state (`holdLastKnown`,
 * `failIfHeightStalled`) must be one state shared by all consumers, not a new one per subscription.
 * Entries are weakly held: they go away with the sources.
 */
export const memoizeBySources = <A extends object, B extends object, R>(create: (a: A, b: B) => R) => {
  const cache = new WeakMap<A, WeakMap<B, R>>()
  return (a: A, b: B): R => {
    const byB = cache.get(a) ?? new WeakMap<B, R>()
    cache.set(a, byB)
    const cached = byB.get(b)
    if (cached !== undefined) return cached
    const created = create(a, b)
    byB.set(b, created)
    return created
  }
}
