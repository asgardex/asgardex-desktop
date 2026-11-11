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
 * Matched case-insensitively. Malformed halt values remain unknown for that key only; unrelated keys are dropped.
 */
// PAUSELPDEPOSIT: gas (`-CHAIN-SYMBOL`) and token pools (`-CHAIN-SYMBOL-0X…`). Written without nested
// quantifiers (`(-[A-Z0-9]+)+`) so eslint security/detect-unsafe-regex stays quiet; same match set.
const HALT_RELEVANT_MIMIR_KEY =
  /^(HALT[A-Z0-9]+(CHAIN|TRADING)|HALTCHAINGLOBAL|HALTTRADING|SOLVENCYHALT[A-Z0-9]+CHAIN|NODEPAUSECHAINGLOBAL|PAUSELP[A-Z0-9]*|PAUSELPDEPOSIT-[A-Z0-9]+-[A-Z0-9-]+)$/

export const isHaltRelevantMimirKey = (key: string): boolean => HALT_RELEVANT_MIMIR_KEY.test(key.toUpperCase())

/**
 * Strict mimir value: a safe integer, as a number or as a string holding one.
 * Mimir values are integers (block heights, flags), so a fractional number (`1.5`, `-0.5`) is as malformed as
 * the string `'1.5'`, and an integer above `Number.MAX_SAFE_INTEGER` can't be compared reliably to a height.
 * `Number('')`, `Number(null)` and `Number(false)` are all `0` ("no halt"), so they are rejected here
 * instead of being coerced.
 */
export const parseMimirValue = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!/^-?\d+$/.test(trimmed)) return undefined
    const parsed = Number(trimmed)
    return Number.isSafeInteger(parsed) ? parsed : undefined
  }
  return undefined
}

/**
 * Parses a `/mimir` response body.
 * - Throws if it is not an object.
 * - A malformed halt value is retained as NaN (unknown for this key, never a proven halt).
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
      // Keep the uncertainty local to this key; mappers distinguish it from proven halts.
      result[key] = Number.NaN
    }
  }
  return result
}
