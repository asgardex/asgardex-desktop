import { afterEach, describe, expect, it, vi } from 'vitest'

import { monotonicNow } from './monotonicClock'

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
