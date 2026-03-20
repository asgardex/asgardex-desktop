import * as RD from '@devexperts/remote-data-ts'
import { type AnyAsset, assetFromString } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { GetDepthHistoryIntervalEnum } from '../midgard/midgardTypes'
import type { ApiGetDepthHistoryParams, DepthHistoryLD } from '../midgard/midgardTypes'
import type { PriceLevel } from './types'

const POLL_INTERVAL_MS = 30_000
const STORAGE_KEY = 'asgardex:priceLevels'

type ApiGetDepthHistory$ = (params: ApiGetDepthHistoryParams) => DepthHistoryLD

// ── LocalStorage helpers ──────────────────────────────────────────────

const loadLevels = (assetKey: string): PriceLevel[] => {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${assetKey}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PriceLevel[]
    return parsed.map((p) => ({ ...p, amountSymbol: p.amountSymbol ?? '', targetAssetKey: p.targetAssetKey ?? '' }))
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
  /** Latest polled prices per asset (THORChain pool price used for triggers) */
  prices$: Rx.Observable<Record<string, number>>
  /** Get levels for a specific asset */
  getLevels: (assetKey: string) => PriceLevel[]
  /** Add a price level for an asset */
  addLevel: (assetKey: string, level: PriceLevel) => void
  /** Remove a price level */
  removeLevel: (assetKey: string, levelId: string) => void
  /** Update a level's properties */
  updateLevel: (assetKey: string, levelId: string, updates: Partial<Omit<PriceLevel, 'id'>>) => void
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

  // Observable prices per asset (THORChain pool price)
  const { get$: prices$, get: getPricesMap, set: setPricesMap } = observableState<Record<string, number>>({})

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

  const updateLevel = (assetKey: string, levelId: string, updates: Partial<Omit<PriceLevel, 'id'>>) => {
    setLevelsForAsset(
      assetKey,
      getLevels(assetKey).map((l) => (l.id === levelId ? { ...l, ...updates } : l))
    )
  }

  // ── Polling logic ───────────────────────────────────────────────────

  const fetchPrice = (poolAsset: AnyAsset): Rx.Observable<number> =>
    FP.pipe(
      apiGetDepthHistory$({ poolAsset, interval: GetDepthHistoryIntervalEnum.Hour, count: 1 }),
      RxOp.map((rd) =>
        FP.pipe(
          rd,
          RD.map((history) => {
            const latest = history.intervals[history.intervals.length - 1]
            return latest ? parseFloat(latest.assetPriceUSD) : null
          })
        )
      ),
      RxOp.map((rd) => (RD.isSuccess(rd) ? rd.value : null)),
      // apiGetDepthHistory$ is backed by a BehaviorSubject that never completes.
      // Filter out pending/initial/failure (null) and take the first real price,
      // so the observable completes and the inFlight guard resets for the next poll.
      RxOp.filter((price): price is number => price !== null),
      RxOp.take(1)
    )

  // Track which levels have had their first price check (to detect immediate fills)
  const seenLevels = new Set<string>()

  const checkCrossings = (assetKey: string, price: number) => {
    const prevPrice = prevPrices[assetKey]

    const levels = getLevels(assetKey).filter((l) => l.status === 'pending')
    for (const level of levels) {
      const firstSeen = !seenLevels.has(level.id)
      if (firstSeen) seenLevels.add(level.id)

      let triggered = false

      if (firstSeen) {
        // On first price check for this level, trigger immediately if price
        // already satisfies the condition (e.g. buy placed above current price)
        triggered = level.type === 'buy' ? price <= level.price : price >= level.price
      } else if (prevPrice !== undefined) {
        // On subsequent checks, detect crossing through the level
        triggered =
          level.type === 'buy'
            ? prevPrice > level.price && price <= level.price
            : prevPrice < level.price && price >= level.price
      }

      if (triggered) {
        crossings$$.next({ levelId: level.id, assetKey, level, currentPrice: price })
      }
    }

    prevPrices[assetKey] = price
    setPricesMap({ ...getPricesMap(), [assetKey]: price })
  }

  // In-flight guard to prevent overlapping fetches per asset
  const inFlight = new Map<string, boolean>()

  // Poll all assets that have pending levels
  const poll = () => {
    const map = getLevelsMap()
    for (const [assetKey, levels] of Object.entries(map)) {
      const hasPending = levels.some((l) => l.status === 'pending')
      if (!hasPending) continue
      if (inFlight.get(assetKey)) continue

      const poolAsset = assetFromString(assetKey)
      if (!poolAsset) continue

      inFlight.set(assetKey, true)
      const sub = fetchPrice(poolAsset).subscribe({
        next: (price) => {
          checkCrossings(assetKey, price)
        },
        complete: () => {
          inFlight.set(assetKey, false)
        },
        error: () => {
          inFlight.set(assetKey, false)
        }
      })
      subscriptions.push(sub)
      // Self-remove when done to prevent unbounded growth
      sub.add(() => {
        const i = subscriptions.indexOf(sub)
        if (i >= 0) subscriptions.splice(i, 1)
      })
    }
  }

  // Start polling
  poll()
  const intervalId = setInterval(poll, POLL_INTERVAL_MS)

  const dispose = () => {
    clearInterval(intervalId)
    subscriptions.forEach((s) => {
      s.unsubscribe()
    })
    crossings$$.complete()
  }

  return {
    levels$,
    crossings$: crossings$$.asObservable(),
    prices$,
    getLevels,
    addLevel,
    removeLevel,
    updateLevel,
    dispose
  }
}
