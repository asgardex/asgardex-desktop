// `haltedChains$` (inbound_addresses) is held by `holdLastKnown`; that freshness state must be one for all
// consumers. A consumer subscribing later (e.g. a newly mounted Deposit / Swap view) must get the current
// checked status - unknown once the list went stale - not a fresh hold on the replayed old list.
import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPoolsService as createMayaPoolsService } from './mayaMidgard/pools'
import { createPoolsService as createThorPoolsService } from './thorMidgard/pools'

const MINUTE = 60 * 1000

describe('services/midgard pools: haltedChains$ shares its freshness state', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it.each([
    ['THOR', createThorPoolsService],
    ['MAYA', createMayaPoolsService]
  ])('%s: a later subscriber gets "unknown" after the list went stale', (_, create) => {
    // last list is replayed to every subscriber, but never refreshed
    const inbound$ = new Rx.BehaviorSubject(RD.success([{ chain: 'BTC', halted: false }]))
    const { haltedChains$ } = (
      create as (deps: unknown) => { haltedChains$: Rx.Observable<RD.RemoteData<Error, string[]>> }
    )({
      midgardUrl$: Rx.NEVER,
      getMidgardDefaultApi: () => ({}),
      selectedPoolAsset$: Rx.NEVER,
      loadInboundAddresses$: () => Rx.NEVER,
      inboundAddressesShared$: inbound$
    })

    const first: RD.RemoteData<Error, string[]>[] = []
    const subFirst = haltedChains$.subscribe((rd) => first.push(rd))
    expect(first.at(-1)).toEqual(RD.success([]))

    // INBOUND_HOLD.maxAgeMs is 15 min (+ one 5s re-check)
    vi.advanceTimersByTime(15 * MINUTE + 5000)
    expect(RD.isFailure(first.at(-1)!)).toBe(true)

    const second: RD.RemoteData<Error, string[]>[] = []
    const subSecond = haltedChains$.subscribe((rd) => second.push(rd))
    expect(second).toHaveLength(1)
    expect(RD.isFailure(second[0])).toBe(true)

    subFirst.unsubscribe()
    subSecond.unsubscribe()
    // kept while the app runs: subscribing again after everyone left still sees the stale state
    const third: RD.RemoteData<Error, string[]>[] = []
    haltedChains$.subscribe((rd) => third.push(rd)).unsubscribe()
    expect(RD.isFailure(third[0])).toBe(true)
  })
})
