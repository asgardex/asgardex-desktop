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

/**
 * Keys of `/mimir` the app reads for halts (see `getThorchainMimirHalt` / `getMayachainMimirHalt`).
 * Matched case-insensitively. Only these can make a mimir response invalid: a malformed value of any
 * other key (there are hundreds) must not take the halt status down.
 */
// PAUSELPDEPOSIT: gas (`-CHAIN-SYMBOL`) and token pools (`-CHAIN-SYMBOL-0X…`). Written without nested
// quantifiers (`(-[A-Z0-9]+)+`) so eslint security/detect-unsafe-regex stays quiet; same match set.
const HALT_RELEVANT_MIMIR_KEY =
  /^(HALT[A-Z0-9]+(CHAIN|TRADING)|HALTCHAINGLOBAL|HALTTRADING|SOLVENCYHALT[A-Z0-9]+CHAIN|NODEPAUSECHAINGLOBAL|PAUSELP[A-Z0-9]*|PAUSELPDEPOSIT-[A-Z0-9]+-[A-Z0-9-]+)$/

export const isHaltRelevantMimirKey = (key: string): boolean => HALT_RELEVANT_MIMIR_KEY.test(key.toUpperCase())

/**
 * Strict mimir value: a finite number, or a string holding an integer.
 * `Number('')`, `Number(null)` and `Number(false)` are all `0` ("no halt"), so they are rejected here
 * instead of being coerced.
 */
export const parseMimirValue = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return /^-?\d+$/.test(trimmed) ? Number(trimmed) : undefined
  }
  return undefined
}

/**
 * Parses a `/mimir` response body.
 * - Throws if it is not a plain object, or if a key the app reads for halts has a malformed value
 *   (the halt status is then unknown, never "no halt").
 * - Malformed values of other keys are dropped.
 */
export const parseMimir = (data: unknown): MimirValues => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Unexpected response format: mimir is not an object')
  }
  const result: MimirValues = {}
  for (const [key, raw] of Object.entries(data)) {
    const value = parseMimirValue(raw)
    if (value !== undefined) {
      result[key] = value
    } else if (isHaltRelevantMimirKey(key)) {
      throw new Error(`Invalid value for mimir key ${key}: ${JSON.stringify(raw)}`)
    }
  }
  return result
}
