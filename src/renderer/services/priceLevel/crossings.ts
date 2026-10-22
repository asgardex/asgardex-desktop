import type { PriceLevel } from './types'

export type SeenState = {
  seen: ReadonlySet<string>
  prev: Readonly<Record<string, number>>
}

export type CrossingHit = {
  levelId: string
  assetKey: string
  level: PriceLevel
  /** Comparable price that crossed: pool USD, or counter units per 1 chart asset. */
  currentPrice: number
}

/**
 * Price the watcher compares with `level.price`.
 * USD levels use the chart asset's pool USD. Pair levels use poolUsd / counterUsd,
 * which is counter units per 1 chart asset.
 */
export const levelComparablePrice = (
  level: Pick<PriceLevel, 'unit' | 'counterAssetKey'>,
  assetKey: string,
  prices: Record<string, number>
): number | null => {
  const own = prices[assetKey]
  if (level.unit !== 'pair') {
    if (own === undefined || !Number.isFinite(own) || own <= 0) return null
    return own
  }
  const counterKey = level.counterAssetKey
  if (!counterKey) return null
  const counter = prices[counterKey]
  if (own === undefined || counter === undefined) return null
  if (!Number.isFinite(own) || own <= 0 || !Number.isFinite(counter) || counter <= 0) return null
  const ratio = own / counter
  if (!Number.isFinite(ratio) || ratio <= 0) return null
  return ratio
}

/** Buy fills at or below the level. Sell fills at or above it. Later polls need a real cross. */
export const priceCrossesLevel = (
  type: 'buy' | 'sell',
  levelPrice: number,
  comparable: number,
  prev: number | undefined,
  firstSeen: boolean
): boolean => {
  if (firstSeen) return type === 'buy' ? comparable <= levelPrice : comparable >= levelPrice
  if (prev === undefined) return false
  return type === 'buy' ? prev > levelPrice && comparable <= levelPrice : prev < levelPrice && comparable >= levelPrice
}

/**
 * Pending levels whose comparable price can be computed.
 * A level with no price yet stays unseen, so the next poll can still first-seen trigger.
 */
export const nextCrossings = (
  levelsByAsset: Record<string, PriceLevel[]>,
  prices: Record<string, number>,
  state: SeenState
): { hits: CrossingHit[]; state: SeenState } => {
  const seen = new Set(state.seen)
  const prev = { ...state.prev }
  const hits: CrossingHit[] = []
  for (const [assetKey, levels] of Object.entries(levelsByAsset)) {
    for (const level of levels) {
      if (level.status !== 'pending') continue
      const comparable = levelComparablePrice(level, assetKey, prices)
      if (comparable === null) continue
      const firstSeen = !seen.has(level.id)
      const previous = prev[level.id]
      if (firstSeen) seen.add(level.id)
      if (priceCrossesLevel(level.type, level.price, comparable, previous, firstSeen)) {
        hits.push({ levelId: level.id, assetKey, level, currentPrice: comparable })
      }
      prev[level.id] = comparable
    }
  }
  return { hits, state: { seen, prev } }
}

/** Pool assets a poll must price: each pending level, plus the pair counter. */
export const assetsToPoll = (levelsByAsset: Record<string, PriceLevel[]>): string[] => {
  const keys: string[] = []
  const seen = new Set<string>()
  const add = (key: string | undefined) => {
    if (!key || seen.has(key)) return
    seen.add(key)
    keys.push(key)
  }
  for (const [assetKey, levels] of Object.entries(levelsByAsset)) {
    if (!levels.some((level) => level.status === 'pending')) continue
    add(assetKey)
    for (const level of levels) {
      if (level.status !== 'pending') continue
      add(level.counterAssetKey)
    }
  }
  return keys
}
