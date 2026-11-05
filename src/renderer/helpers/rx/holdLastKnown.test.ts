import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import { describe, expect, it, vi } from 'vitest'

import { evaluateHold, holdInput, holdLastKnown, HoldState, INITIAL_HOLD_STATE } from './holdLastKnown'

const OPTS = { maxAgeMs: 1000, maxFailures: 2, pendingTimeoutMs: 100 }
const fail = RD.failure(Error('down'))

const feed = (inputs: Array<[RD.RemoteData<Error, number>, number]>): HoldState<number> =>
  inputs.reduce((state, [rd, at]) => holdInput(state, rd, at), INITIAL_HOLD_STATE<number>())

describe('helpers/rx/holdLastKnown', () => {
  it('publishes a fresh success', () => {
    expect(evaluateHold(feed([[RD.success(1), 0]]), 10, OPTS)).toEqual(RD.success(1))
  })

  it('drops a success older than maxAgeMs (stale -> failure)', () => {
    expect(RD.isFailure(evaluateHold(feed([[RD.success(1), 0]]), 1000, OPTS))).toBe(true)
  })

  it('keeps the last success for up to maxFailures failures in a row, then fails', () => {
    const one = feed([
      [RD.success(1), 0],
      [fail, 10]
    ])
    expect(evaluateHold(one, 20, OPTS)).toEqual(RD.success(1))
    const two = holdInput(one, fail, 20)
    expect(evaluateHold(two, 30, OPTS)).toEqual(RD.success(1))
    const three = holdInput(two, fail, 30)
    expect(RD.isFailure(evaluateHold(three, 40, OPTS))).toBe(true)
  })

  it('a new success resets the failure count', () => {
    const s = feed([
      [RD.success(1), 0],
      [fail, 1],
      [fail, 2],
      [RD.success(2), 3],
      [fail, 4]
    ])
    expect(evaluateHold(s, 5, OPTS)).toEqual(RD.success(2))
  })

  it('failure with nothing held is published', () => {
    expect(RD.isFailure(evaluateHold(feed([[fail, 0]]), 1, OPTS))).toBe(true)
  })

  it('pending keeps a held success', () => {
    const s = feed([
      [RD.success(1), 0],
      [RD.pending, 10]
    ])
    expect(evaluateHold(s, 500, OPTS)).toEqual(RD.success(1))
  })

  it('pending with nothing held turns into failure after pendingTimeoutMs', () => {
    const s = feed([[RD.pending, 0]])
    expect(RD.isPending(evaluateHold(s, 99, OPTS))).toBe(true)
    expect(RD.isFailure(evaluateHold(s, 100, OPTS))).toBe(true)
  })

  it('repeated pending keeps the first pending time', () => {
    const s = feed([
      [RD.pending, 0],
      [RD.pending, 90]
    ])
    expect(RD.isFailure(evaluateHold(s, 100, OPTS))).toBe(true)
  })

  it('Failure x3 then Pending stays unknown: the old value does not come back (no flapping)', () => {
    const s = feed([
      [RD.success(1), 0],
      [fail, 1],
      [fail, 2],
      [fail, 3]
    ])
    expect(RD.isFailure(evaluateHold(s, 4, OPTS))).toBe(true)
    const reload = holdInput(s, RD.pending, 5)
    expect(RD.isFailure(evaluateHold(reload, 6, OPTS))).toBe(true)
    // still unknown while the reload stays pending
    expect(RD.isFailure(evaluateHold(holdInput(reload, RD.pending, 7), 8, OPTS))).toBe(true)
    // a real success recovers
    expect(evaluateHold(holdInput(reload, RD.success(2), 9), 10, OPTS)).toEqual(RD.success(2))
  })

  it('Failure x2 then Pending still keeps the held value', () => {
    const s = feed([
      [RD.success(1), 0],
      [fail, 1],
      [fail, 2],
      [RD.pending, 3]
    ])
    expect(evaluateHold(s, 4, OPTS)).toEqual(RD.success(1))
  })
})

describe('helpers/rx/holdLastKnown operator clock', () => {
  it('measures age with the monotonic clock: a wall-clock jump back does not keep a value fresh', () => {
    vi.useFakeTimers()
    try {
      const source$ = new Rx.BehaviorSubject<RD.RemoteData<Error, number>>(RD.success(1))
      const out: Array<RD.RemoteData<Error, number>> = []
      const sub = source$.pipe(holdLastKnown<number>({ ...OPTS, tickMs: 100 })).subscribe((v) => out.push(v))
      vi.advanceTimersByTime(500)
      // wall clock jumps back 1h: must not matter
      vi.setSystemTime(Date.now() - 60 * 60 * 1000)
      vi.advanceTimersByTime(600)
      expect(RD.isFailure(out[out.length - 1])).toBe(true)
      sub.unsubscribe()
    } finally {
      vi.useRealTimers()
    }
  })
})
