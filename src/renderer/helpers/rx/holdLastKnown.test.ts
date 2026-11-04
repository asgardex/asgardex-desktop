import * as RD from '@devexperts/remote-data-ts'
import { describe, expect, it } from 'vitest'

import { evaluateHold, holdInput, HoldState, INITIAL_HOLD_STATE } from './holdLastKnown'

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
})
