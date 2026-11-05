import { afterEach, describe, expect, it, vi } from 'vitest'

import { createFailClosedClock, monotonicNow } from './monotonicClock'

describe('helpers/monotonicClock', () => {
  afterEach(() => vi.restoreAllMocks())

  it('uses performance.now(), not the wall clock', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1234)
    const date = vi.spyOn(Date, 'now')
    expect(monotonicNow()).toBe(1234)
    expect(date).not.toHaveBeenCalled()
  })

  it('a backwards wall-clock jump does not move it back', () => {
    const before = monotonicNow()
    vi.spyOn(Date, 'now').mockReturnValue(0)
    expect(monotonicNow()).toBeGreaterThanOrEqual(before)
  })
})

describe('helpers/monotonicClock createFailClosedClock', () => {
  const clocks = () => {
    const t = { mono: 0, wall: 1_000_000 }
    const clock = createFailClosedClock(
      () => t.mono,
      () => t.wall
    )
    return { t, clock }
  }

  it('advances with both clocks in step', () => {
    const { t, clock } = clocks()
    t.mono += 100
    t.wall += 100
    expect(clock()).toBe(100)
  })

  it('wall clock jumps back: the monotonic time still counts', () => {
    const { t, clock } = clocks()
    t.mono += 100
    t.wall -= 3_600_000
    expect(clock()).toBe(100)
  })

  it('wall clock jumps forward: the larger wall time counts (fails closed)', () => {
    const { t, clock } = clocks()
    t.mono += 100
    t.wall += 3_600_000
    expect(clock()).toBe(3_600_000)
  })

  it('a sleep the monotonic clock did not count: the wall time counts', () => {
    const { t, clock } = clocks()
    t.wall += 20 * 60 * 1000 // mono paused while suspended
    expect(clock()).toBe(20 * 60 * 1000)
  })

  it('never goes back, and keeps counting after a backwards wall jump', () => {
    const { t, clock } = clocks()
    t.mono += 100
    t.wall += 100
    expect(clock()).toBe(100)
    t.wall -= 1000
    expect(clock()).toBe(100)
    t.mono += 50
    t.wall += 50
    expect(clock()).toBe(150)
  })
})
