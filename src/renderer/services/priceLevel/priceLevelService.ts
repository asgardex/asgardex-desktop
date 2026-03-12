import * as RD from '@devexperts/remote-data-ts'
import { type AnyAsset, assetFromString } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import type { ApiGetDepthHistoryParams, DepthHistoryLD } from '../midgard/midgardTypes'
import type { PriceLevel } from '../../views/pools/detail/types'

const POLL_INTERVAL_MS = 30_000
const STORAGE_KEY = 'asgardex:priceLevels'

type ApiGetDepthHistory$ = (params: ApiGetDepthHistoryParams) => DepthHistoryLD

// ── LocalStorage helpers ──────────────────────────────────────────────

const loadLevels = (assetKey: string): PriceLevel[] => {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${assetKey}`)
    return raw ? (JSON.parse(raw) as PriceLevel[]) : []
  } catch {
    return []
  }
}

const persistLevels = (assetKey: string, levels: PriceLevel[]) => {
  try {
    const active = levels.filter((l) => l.status !== 'completed' && l.status !== 'failed')
    if (active.length > 0) {
      localStorage.setItem(`${STORAGE_KEY}:${assetKey}`, JSON.stringify(active))
    } else {
      localStorage.removeItem(`${STORAGE_KEY}:${assetKey}`)
    }
  } catch {
    // ignore
  }
}

const loadAllAssetKeys = (): string[] => {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(`${STORAGE_KEY}:`)) {
      keys.push(key.replace(`${STORAGE_KEY}:`, ''))
    }
  }
  return keys
}

// ── Types ─────────────────────────────────────────────────────────────

export type PriceLevelEvent = {
  levelId: string
  assetKey: string
  level: PriceLevel
  currentPrice: number
}

type PriceLevelMap = Record<string, PriceLevel[]>

export type PriceLevelService = {
  /** All levels keyed by assetToString(poolAsset) */
  levels$: Rx.Observable<PriceLevelMap>
  /** Stream of crossing events (for UI to react to) */
  crossings$: Rx.Observable<PriceLevelEvent>
  /** Get levels for a specific asset */
  getLevels: (assetKey: string) => PriceLevel[]
  /** Add a price level for an asset */
  addLevel: (assetKey: string, level: PriceLevel) => void
  /** Remove a price level */
  removeLevel: (assetKey: string, levelId: string) => void
  /** Update a level's properties */
  updateLevel: (assetKey: string, levelId: string, updates: Partial<PriceLevel>) => void
  /** Dispose all subscriptions */
  dispose: () => void
}

// ── Service factory ───────────────────────────────────────────────────

export const createPriceLevelService = (apiGetDepthHistory$: ApiGetDepthHistory$): PriceLevelService => {
  const subscriptions: Rx.Subscription[] = []

  // Load all persisted levels on init
  const initialLevels: PriceLevelMap = {}
  for (const assetKey of loadAllAssetKeys()) {
    const levels = loadLevels(assetKey)
    if (levels.length > 0) initialLevels[assetKey] = levels
  }

  const { get$: levels$, get: getLevelsMap, set: setLevelsMap } = observableState<PriceLevelMap>(initialLevels)

  const crossings$$ = new Rx.Subject<PriceLevelEvent>()

  // Previous price per asset for crossing detection
  const prevPrices: Record<string, number> = {}

  // ── Public methods ──────────────────────────────────────────────────

  const getLevels = (assetKey: string): PriceLevel[] => getLevelsMap()[assetKey] ?? []

  const setLevelsForAsset = (assetKey: string, levels: PriceLevel[]) => {
    const map = { ...getLevelsMap() }
    if (levels.length > 0) {
      map[assetKey] = levels
    } else {
      delete map[assetKey]
    }
    setLevelsMap(map)
    persistLevels(assetKey, levels)
  }

  const addLevel = (assetKey: string, level: PriceLevel) => {
    setLevelsForAsset(assetKey, [...getLevels(assetKey), level])
  }

  const removeLevel = (assetKey: string, levelId: string) => {
    setLevelsForAsset(
      assetKey,
      getLevels(assetKey).filter((l) => l.id !== levelId)
    )
  }

  const updateLevel = (assetKey: string, levelId: string, updates: Partial<PriceLevel>) => {
    setLevelsForAsset(
      assetKey,
      getLevels(assetKey).map((l) => (l.id === levelId ? { ...l, ...updates } : l))
    )
  }

  // ── Polling logic ───────────────────────────────────────────────────

  const fetchPrice = (poolAsset: AnyAsset): Rx.Observable<number | null> =>
    FP.pipe(
      apiGetDepthHistory$({ poolAsset, count: 1 }),
      RxOp.map((rd) =>
        FP.pipe(
          rd,
          RD.map((history) => {
            const latest = history.intervals[history.intervals.length - 1]
            return latest ? parseFloat(latest.assetPriceUSD) : null
          })
        )
      ),
      RxOp.map((rd) => (RD.isSuccess(rd) ? rd.value : null))
    )

  const checkCrossings = (assetKey: string, price: number) => {
    const prevPrice = prevPrices[assetKey]
    if (prevPrice === undefined) {
      prevPrices[assetKey] = price
      return
    }

    const levels = getLevels(assetKey).filter((l) => l.status === 'pending')
    for (const level of levels) {
      const crossed =
        level.type === 'buy'
          ? prevPrice > level.price && price <= level.price
          : prevPrice < level.price && price >= level.price
      if (crossed) {
        crossings$$.next({ levelId: level.id, assetKey, level, currentPrice: price })
      }
    }

    prevPrices[assetKey] = price
  }

  // Poll all assets that have pending levels
  const poll = () => {
    const map = getLevelsMap()
    for (const [assetKey, levels] of Object.entries(map)) {
      const hasPending = levels.some((l) => l.status === 'pending')
      if (!hasPending) continue

      const poolAsset = assetFromString(assetKey)
      if (!poolAsset) continue

      const sub = fetchPrice(poolAsset).subscribe((price) => {
        if (price !== null) {
          checkCrossings(assetKey, price)
        }
      })
      // Each poll subscription completes when the API responds, so just let it finish
      subscriptions.push(sub)
    }
  }

  // Start polling
  poll()
  const intervalId = setInterval(poll, POLL_INTERVAL_MS)

  const dispose = () => {
    clearInterval(intervalId)
    subscriptions.forEach((s) => s.unsubscribe())
    crossings$$.complete()
  }

  return {
    levels$,
    crossings$: crossings$$.asObservable(),
    getLevels,
    addLevel,
    removeLevel,
    updateLevel,
    dispose
  }
}
