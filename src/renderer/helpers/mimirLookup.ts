/** Anything shaped like THORNode / MAYANode `/mimir` (`key -> value`) */
type MimirValues = { [key: string]: number }

// Warn once per (source, key) - mimir is re-mapped on every lastblock tick
const warnedKeys = new Set<string>()

/** Test helper: forget which casing mismatches have been logged */
export const resetMimirCasingWarnings = () => warnedKeys.clear()

/**
 * Returns a lookup that finds mimir values by key, ignoring case.
 *
 * THORNode and MAYANode send upper-case keys (`HALTBTCCHAIN`), but a node (or a proxy in front of it)
 * could change that. A halt published under another casing (`HaltBtcChain`) must never read as
 * "no halt", so every spelling of a key is returned, and a warning is logged when one is not
 * spelled exactly as requested.
 *
 * The lookup returns *all* values found for the key (a node could send the same key in two casings);
 * callers treat the key as active when any of them is active.
 */
export const createMimirLookup = (mimir: MimirValues, source: string) => {
  const index = new Map<string, Array<{ key: string; value: number }>>()
  Object.entries(mimir).forEach(([key, value]) => {
    const normalized = key.toUpperCase()
    index.set(normalized, [...(index.get(normalized) ?? []), { key, value }])
  })

  return (key: string): number[] => {
    const entries = index.get(key.toUpperCase()) ?? []
    entries.forEach((entry) => {
      if (entry.key === key) return
      const id = `${source}:${entry.key}`
      if (warnedKeys.has(id)) return
      warnedKeys.add(id)
      // `console.warn` on purpose, not `helpers/logger`: the logger is silent outside dev builds, and
      // this is a safety signal. Matching is case-insensitive, so the halt is still applied.
      // eslint-disable-next-line no-console
      console.warn(`[ASGARDEX][${source}] mimir key "${entry.key}" has unexpected casing, read as "${key}"`)
    })
    return entries.map(({ value }) => value)
  }
}
