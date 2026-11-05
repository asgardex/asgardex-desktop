import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import { describe, expect, it, vi } from 'vitest'

import { evaluateStall, failIfHeightStalled, INITIAL_STALL_STATE, StallState, stallInput } from './failIfHeightStalled'

const getHeight = (h: number) => h
const STALL = 1000

const feed = (inputs: Array<[RD.RemoteData<Error, number>, number]>): StallState<number> =>
  inputs.reduce((s, [rd, at]) => stallInput(s, rd, at, getHeight), INITIAL_STALL_STATE<number>())

describe('helpers/rx/failIfHeightStalled', () => {
  it('passes an advancing height', () => {
    const s = feed([
      [RD.success(1), 0],
      [RD.success(2), 900],
      [RD.success(3), 1800]
    ])
    expect(evaluateStall(s, 2000, STALL)).toEqual(RD.success(3))
  })

  it('the same height served again and again (HTTP 200) turns into a failure after stallMs', () => {
    const s = feed([
      [RD.success(5), 0],
      [RD.success(5), 500],
      [RD.success(5), 999]
    ])
    expect(evaluateStall(s, 999, STALL)).toEqual(RD.success(5))
    expect(RD.isFailure(evaluateStall(s, 1000, STALL))).toBe(true)
  })

  it('recovers when the height advances again', () => {
    const stalled = feed([
      [RD.success(5), 0],
      [RD.success(5), 1500]
    ])
    expect(RD.isFailure(evaluateStall(stalled, 1500, STALL))).toBe(true)
    expect(evaluateStall(stallInput(stalled, RD.success(6), 1600, getHeight), 1600, STALL)).toEqual(RD.success(6))
  })

  it('passes pending and failure through unchanged', () => {
    const fail = RD.failure(Error('down'))
    expect(evaluateStall(feed([[fail, 0]]), 5000, STALL)).toBe(fail)
    expect(RD.isPending(evaluateStall(feed([[RD.pending, 0]]), 5000, STALL))).toBe(true)
  })

  it('operator: re-checks on its timer while the source is silent', () => {
    vi.useFakeTimers()
    try {
      const out: Array<RD.RemoteData<Error, number>> = []
      const sub = Rx.of(RD.success(7))
        .pipe(failIfHeightStalled<number>({ getHeight, stallMs: STALL, tickMs: 100 }))
        .subscribe((v) => out.push(v))
      expect(out[out.length - 1]).toEqual(RD.success(7))
      vi.advanceTimersByTime(1100)
      expect(RD.isFailure(out[out.length - 1])).toBe(true)
      sub.unsubscribe()
    } finally {
      vi.useRealTimers()
    }
  })
})
