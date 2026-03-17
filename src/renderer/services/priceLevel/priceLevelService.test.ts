import * as RD from '@devexperts/remote-data-ts'
import type { DepthHistory, DepthHistoryItem } from '@xchainjs/xchain-midgard'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import type { PriceLevelEvent } from './priceLevelService'
import { createPriceLevelService } from './priceLevelService'
import type { PriceLevel } from './types'

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a mock apiGetDepthHistory$ that emits a given USD price */
const mockDepthApi = (priceUSD: number) => {
  const item: Partial<DepthHistoryItem> = { assetPriceUSD: String(priceUSD) }
  const history: Partial<DepthHistory> = {
    intervals: [item as DepthHistoryItem]
  }
  return () => Rx.of(RD.success(history as DepthHistory))
}

/** Build a level helper */
const mkLevel = (overrides: Partial<PriceLevel> & { id: string; price: number; type: 'buy' | 'sell' }): PriceLevel => ({
  amount: 100,
  amountSymbol: '$',
  status: 'pending',
  ...overrides
})

// ── localStorage stub ────────────────────────────────────────────────

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() {
      return storage.size
    }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────

describe('priceLevelService', () => {
  describe('CRUD operations', () => {
    it('adds, retrieves, and removes levels', () => {
      const svc = createPriceLevelService(mockDepthApi(100))

      const level = mkLevel({ id: 'l1', price: 50, type: 'buy' })
      svc.addLevel('ETH.ETH', level)

      expect(svc.getLevels('ETH.ETH')).toHaveLength(1)
      expect(svc.getLevels('ETH.ETH')[0].id).toBe('l1')

      svc.removeLevel('ETH.ETH', 'l1')
      expect(svc.getLevels('ETH.ETH')).toHaveLength(0)

      svc.dispose()
    })

    it('updates level properties', () => {
      const svc = createPriceLevelService(mockDepthApi(100))

      svc.addLevel('ETH.ETH', mkLevel({ id: 'l1', price: 50, type: 'buy' }))
      svc.updateLevel('ETH.ETH', 'l1', { status: 'triggered' })

      expect(svc.getLevels('ETH.ETH')[0].status).toBe('triggered')

      svc.dispose()
    })

    it('persists active levels to localStorage', () => {
      const svc = createPriceLevelService(mockDepthApi(100))

      svc.addLevel('ETH.ETH', mkLevel({ id: 'l1', price: 50, type: 'buy' }))
      expect(storage.has('asgardex:priceLevels:ETH.ETH')).toBe(true)

      svc.removeLevel('ETH.ETH', 'l1')
      expect(storage.has('asgardex:priceLevels:ETH.ETH')).toBe(false)

      svc.dispose()
    })
  })

  describe('non-completing observable (real-world scenario)', () => {
    it('polls repeatedly even when apiGetDepthHistory$ never completes', () => {
      // This simulates the real Midgard API: emits RD.pending then RD.success,
      // but the observable never completes (backed by a BehaviorSubject).
      // The fix: fetchPrice uses filter+take(1) to auto-complete.
      const priceSubjects: Rx.BehaviorSubject<RD.RemoteData<Error, DepthHistory>>[] = []

      const api = () => {
        const subj = new Rx.BehaviorSubject<RD.RemoteData<Error, DepthHistory>>(RD.pending)
        priceSubjects.push(subj)
        return subj.asObservable() // never completes (like real Midgard)
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'buy1', price: 100, type: 'buy' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // First poll
      vi.advanceTimersByTime(30_000)
      const first = priceSubjects[priceSubjects.length - 1]
      // Emit success (simulating Midgard response) — filter+take(1) will complete it
      first.next(RD.success({ intervals: [{ assetPriceUSD: '110' }] } as unknown as DepthHistory))
      expect(events).toHaveLength(0) // First price just sets prevPrice

      // Second poll — should NOT be blocked by inFlight since take(1) completed the first
      vi.advanceTimersByTime(30_000)
      expect(priceSubjects.length).toBeGreaterThanOrEqual(2) // new subject was created
      const second = priceSubjects[priceSubjects.length - 1]
      second.next(RD.success({ intervals: [{ assetPriceUSD: '95' }] } as unknown as DepthHistory))

      expect(events).toHaveLength(1)
      expect(events[0].levelId).toBe('buy1')
      expect(events[0].currentPrice).toBe(95)

      svc.dispose()
      vi.useRealTimers()
    })
  })

  describe('crossing detection (unit logic)', () => {
    // Test the crossing logic by driving checkCrossings via the polling mechanism
    // with a controllable price stream

    it('buy crossing: price drops below level', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      // Create a mock API that returns a controllable subject each call
      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'buy1', price: 100, type: 'buy' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // Initial poll happened at creation (no levels yet, so nothing fetched)
      // Advance to first poll with the level
      vi.advanceTimersByTime(30_000)
      expect(priceSubjects.length).toBeGreaterThanOrEqual(1)

      // Emit first price: 110 (above buy level) — sets prevPrice, no crossing
      const firstSubj = priceSubjects[priceSubjects.length - 1]
      firstSubj.next(110)
      firstSubj.complete()
      expect(events).toHaveLength(0)

      // Next poll
      vi.advanceTimersByTime(30_000)
      const secondSubj = priceSubjects[priceSubjects.length - 1]
      // Emit second price: 95 (below buy level of 100) — crossing!
      secondSubj.next(95)
      secondSubj.complete()

      expect(events).toHaveLength(1)
      expect(events[0].levelId).toBe('buy1')
      expect(events[0].level.type).toBe('buy')
      expect(events[0].currentPrice).toBe(95)

      svc.dispose()
      vi.useRealTimers()
    })

    it('sell crossing: price rises above level', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      svc.addLevel('BTC.BTC', mkLevel({ id: 'sell1', price: 50000, type: 'sell' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // First poll
      vi.advanceTimersByTime(30_000)
      const first = priceSubjects[priceSubjects.length - 1]
      first.next(48000) // below sell level
      first.complete()
      expect(events).toHaveLength(0)

      // Second poll
      vi.advanceTimersByTime(30_000)
      const second = priceSubjects[priceSubjects.length - 1]
      second.next(51000) // above sell level of 50000 — crossing!
      second.complete()

      expect(events).toHaveLength(1)
      expect(events[0].levelId).toBe('sell1')
      expect(events[0].level.type).toBe('sell')
      expect(events[0].currentPrice).toBe(51000)

      svc.dispose()
      vi.useRealTimers()
    })

    it('no crossing when price stays on same side', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'buy1', price: 100, type: 'buy' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // First poll: price 110
      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(110)
      priceSubjects[priceSubjects.length - 1].complete()

      // Second poll: price 105 (still above 100, no crossing)
      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(105)
      priceSubjects[priceSubjects.length - 1].complete()

      expect(events).toHaveLength(0)

      svc.dispose()
      vi.useRealTimers()
    })

    it('does not trigger non-pending levels', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      // Add a level that's already completed — should not trigger
      svc.addLevel('ETH.ETH', mkLevel({ id: 'buy1', price: 100, type: 'buy', status: 'completed' }))
      // Also add a pending level for a different price that won't cross
      svc.addLevel('ETH.ETH', mkLevel({ id: 'buy2', price: 50, type: 'buy' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // First poll: 110
      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(110)
      priceSubjects[priceSubjects.length - 1].complete()

      // Second poll: 95 — crosses 100 (completed) but not 50 (pending)
      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(95)
      priceSubjects[priceSubjects.length - 1].complete()

      // Only pending levels are checked — completed buy1 should NOT trigger
      // buy2 at 50 is pending but price didn't cross 50
      expect(events).toHaveLength(0)

      svc.dispose()
      vi.useRealTimers()
    })

    it('exact price match triggers crossing', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'buy1', price: 100, type: 'buy' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // First poll: 110
      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(110)
      priceSubjects[priceSubjects.length - 1].complete()

      // Second poll: exactly 100 — price <= level.price, should trigger
      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(100)
      priceSubjects[priceSubjects.length - 1].complete()

      expect(events).toHaveLength(1)
      expect(events[0].currentPrice).toBe(100)

      svc.dispose()
      vi.useRealTimers()
    })

    it('updates prices$ observable on each poll', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'buy1', price: 100, type: 'buy' }))

      let latestPrices: Record<string, number> = {}
      svc.prices$.subscribe((p) => {
        latestPrices = p
      })

      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(2500)
      priceSubjects[priceSubjects.length - 1].complete()

      expect(latestPrices['ETH.ETH']).toBe(2500)

      svc.dispose()
      vi.useRealTimers()
    })

    it('handles multiple assets independently', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'eth-buy', price: 2000, type: 'buy' }))
      svc.addLevel('BTC.BTC', mkLevel({ id: 'btc-sell', price: 60000, type: 'sell' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // First poll — both assets fetched (2 subjects created)
      vi.advanceTimersByTime(30_000)
      // ETH price 2500, BTC price 55000
      const initialSubjects = priceSubjects.slice(-2)
      initialSubjects[0].next(2500)
      initialSubjects[0].complete()
      initialSubjects[1].next(55000)
      initialSubjects[1].complete()
      expect(events).toHaveLength(0)

      // Second poll
      vi.advanceTimersByTime(30_000)
      const secondSubjects = priceSubjects.slice(-2)
      // ETH drops to 1900 (crosses 2000 buy) — trigger
      secondSubjects[0].next(1900)
      secondSubjects[0].complete()
      // BTC rises to 61000 (crosses 60000 sell) — trigger
      secondSubjects[1].next(61000)
      secondSubjects[1].complete()

      expect(events).toHaveLength(2)
      const ethEvent = events.find((e) => e.assetKey === 'ETH.ETH')
      const btcEvent = events.find((e) => e.assetKey === 'BTC.BTC')
      expect(ethEvent?.levelId).toBe('eth-buy')
      expect(btcEvent?.levelId).toBe('btc-sell')

      svc.dispose()
      vi.useRealTimers()
    })
  })

  describe('immediate trigger on first price', () => {
    it('buy triggers immediately when price is already below level', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      // Buy at 100 — price will already be below (95)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'buy1', price: 100, type: 'buy' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // First poll — price is 95 which is already below buy level of 100
      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(95)
      priceSubjects[priceSubjects.length - 1].complete()

      // Should trigger immediately on first check
      expect(events).toHaveLength(1)
      expect(events[0].levelId).toBe('buy1')
      expect(events[0].currentPrice).toBe(95)

      svc.dispose()
      vi.useRealTimers()
    })

    it('sell triggers immediately when price is already above level', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'sell1', price: 100, type: 'sell' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // First poll — price is 110 which is already above sell level of 100
      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(110)
      priceSubjects[priceSubjects.length - 1].complete()

      expect(events).toHaveLength(1)
      expect(events[0].levelId).toBe('sell1')
      expect(events[0].currentPrice).toBe(110)

      svc.dispose()
      vi.useRealTimers()
    })

    it('does not immediate-trigger buy when price is above level', () => {
      const priceSubjects: Rx.Subject<number>[] = []

      const api = () => {
        const subj = new Rx.ReplaySubject<number>(1)
        priceSubjects.push(subj)
        return subj.pipe(
          RxOp.map((p) => RD.success({ intervals: [{ assetPriceUSD: String(p) }] } as unknown as DepthHistory))
        )
      }

      vi.useFakeTimers()

      const svc = createPriceLevelService(api)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'buy1', price: 100, type: 'buy' }))

      const events: PriceLevelEvent[] = []
      svc.crossings$.subscribe((e) => events.push(e))

      // First poll — price 110 is above buy level 100, should NOT trigger
      vi.advanceTimersByTime(30_000)
      priceSubjects[priceSubjects.length - 1].next(110)
      priceSubjects[priceSubjects.length - 1].complete()

      expect(events).toHaveLength(0)

      svc.dispose()
      vi.useRealTimers()
    })
  })

  describe('dispose', () => {
    it('stops polling and completes crossings$', () => {
      vi.useFakeTimers()

      const api = mockDepthApi(100)
      const svc = createPriceLevelService(api)
      svc.addLevel('ETH.ETH', mkLevel({ id: 'l1', price: 50, type: 'buy' }))

      let completed = false
      svc.crossings$.subscribe({ complete: () => (completed = true) })

      svc.dispose()

      expect(completed).toBe(true)

      vi.useRealTimers()
    })
  })
})
