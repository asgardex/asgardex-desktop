import * as RD from '@devexperts/remote-data-ts'
import type { Pool } from '@xchainjs/xchain-thornode'
import { type AnyAsset, assetFromString } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { LiveData } from '../../helpers/rx/liveData'
import { observableState } from '../../helpers/stateHelper'
import { FETCH_TIMEOUT_MS, POLL_INTERVAL_MS, RUNE_ASSET_KEY, RUNE_REFERENCE_POOL } from './const'
import { assetsToPoll, nextCrossings } from './crossings'
import type { PriceLevel } from './types'

const STORAGE_KEY = 'asgardex:priceLevels'

type ApiGetPool$ = (asset: AnyAsset) => LiveData<Error, Pool>

/** THORNode `asset_tor_price` is the USD (TOR) price of the asset in 1e8 base units. */
export const poolToUsdPrice = ({ asset_tor_price }: Pool): number | null => {
  const price = Number(asset_tor_price) / 10 ** THORCHAIN_DECIMAL
  return Number.isFinite(price) && price > 0 ? price : null
}

/** RUNE USD from any pool: the asset's USD price times the pool's asset per RUNE. */
export const poolToRuneUsdPrice = (pool: Pool): number | null => {
  const assetUsd = poolToUsdPrice(pool)
  const assetPerRune = Number(pool.balance_asset) / Number(pool.balance_rune)
  if (assetUsd === null || !Number.isFinite(assetPerRune) || assetPerRune <= 0) return null
  return assetUsd * assetPerRune
}

// ── LocalStorage helpers ──────────────────────────────────────────────

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

/** Drop every saved level. A limit order does not survive closing the app. */
const clearPersistedPriceLevels = () => {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`${STORAGE_KEY}:`)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // ignore
  }
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
  /**
   * Pause this asset's pending levels when its chart unmounts, or resume them when it mounts.
   * Resume forgets the last cross so the next poll can first-seen trigger.
   */
  setWatching: (assetKey: string, watching: boolean) => void
  /** Forget a level's last cross so the next poll is a first-seen check. */
  rearmLevel: (levelId: string) => void
  /** Dispose all subscriptions */
  dispose: () => void
}

// ── Service factory ───────────────────────────────────────────────────

export const createPriceLevelService = (apiGetPool$: ApiGetPool$): PriceLevelService => {
  const subscriptions: Rx.Subscription[] = []

  // Saved levels belong to the previous process. Closing the app cancels them,
  // so a new session starts with an empty book and does not fire a leftover order.
  clearPersistedPriceLevels()
  const initialLevels: PriceLevelMap = {}

  const { get$: levels$, get: getLevelsMap, set: setLevelsMap } = observableState<PriceLevelMap>(initialLevels)

  const crossings$$ = new Rx.Subject<PriceLevelEvent>()

  // Observable prices per asset (THORChain pool price)
  const { get$: prices$, get: getPricesMap, set: setPricesMap } = observableState<Record<string, number>>({})

  // Previous comparable price per level. Pair and USD levels on one asset do not share an edge.
  let prevByLevel: Record<string, number> = {}
  // Levels that already have a comparable price. Resume and rearm delete ids so the next poll is first-seen.
  let seenLevels = new Set<string>()

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

  const forgetLevel = (levelId: string) => {
    seenLevels.delete(levelId)
    if (prevByLevel[levelId] === undefined) return
    const next = { ...prevByLevel }
    delete next[levelId]
    prevByLevel = next
  }

  const rearmLevel = (levelId: string) => {
    forgetLevel(levelId)
  }

  const setWatching = (assetKey: string, watching: boolean) => {
    const levels = getLevels(assetKey)
    if (watching) {
      let changed = false
      const next = levels.map((level) => {
        if (level.status !== 'paused') return level
        changed = true
        forgetLevel(level.id)
        return { ...level, status: 'pending' as const, error: undefined }
      })
      if (changed) setLevelsForAsset(assetKey, next)
      return
    }
    let changed = false
    const next = levels.map((level) => {
      if (level.status !== 'pending') return level
      changed = true
      forgetLevel(level.id)
      return { ...level, status: 'paused' as const }
    })
    if (changed) setLevelsForAsset(assetKey, next)
  }

  // ── Polling logic ───────────────────────────────────────────────────

  const fetchPoolPrice = (poolAsset: AnyAsset, toPrice: (pool: Pool) => number | null): Rx.Observable<number | null> =>
    FP.pipe(
      apiGetPool$(poolAsset),
      RxOp.filter((rd) => RD.isSuccess(rd) || RD.isFailure(rd)),
      RxOp.take(1),
      RxOp.map((rd) => (RD.isSuccess(rd) ? toPrice(rd.value) : null))
    )

  const runeReferencePool = assetFromString(RUNE_REFERENCE_POOL)

  // The streams never complete. Take the first settled result so the observable completes
  // and the inFlight guard resets for the next poll.
  const fetchPrice = (assetKey: string, poolAsset: AnyAsset): Rx.Observable<number> =>
    FP.pipe(
      assetKey === RUNE_ASSET_KEY
        ? runeReferencePool
          ? fetchPoolPrice(runeReferencePool, poolToRuneUsdPrice)
          : Rx.EMPTY
        : fetchPoolPrice(poolAsset, poolToUsdPrice),
      // A hung request errors out; poll() resets inFlight and the next poll retries.
      RxOp.timeout(FETCH_TIMEOUT_MS),
      RxOp.filter((price): price is number => price !== null)
    )

  const publishPrice = (assetKey: string, price: number) => {
    const prices = { ...getPricesMap(), [assetKey]: price }
    setPricesMap(prices)
    const result = nextCrossings(getLevelsMap(), prices, { seen: seenLevels, prev: prevByLevel })
    seenLevels = new Set(result.state.seen)
    prevByLevel = result.state.prev
    for (const hit of result.hits) crossings$$.next(hit)
  }

  // In-flight guard to prevent overlapping fetches per asset
  const inFlight = new Map<string, boolean>()

  // Poll every pool a pending level needs, including a pair order's counter.
  const poll = () => {
    for (const assetKey of assetsToPoll(getLevelsMap())) {
      if (inFlight.get(assetKey)) continue

      const poolAsset = assetFromString(assetKey)
      if (!poolAsset) continue

      inFlight.set(assetKey, true)
      const sub = fetchPrice(assetKey, poolAsset).subscribe({
        next: (price) => {
          publishPrice(assetKey, price)
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
    setWatching,
    rearmLevel,
    dispose
  }
}
