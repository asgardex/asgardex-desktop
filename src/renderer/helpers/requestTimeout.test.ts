import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { withTimeout } from './requestTimeout'

describe('helpers/requestTimeout withTimeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('resolves with the value if the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(1), 1000)).resolves.toBe(1)
  })

  it('passes a rejection through', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom')
  })

  it('rejects a promise that never settles', async () => {
    const p = withTimeout(new Promise(() => {}), 1000, 'mimir')
    vi.advanceTimersByTime(1000)
    await expect(p).rejects.toThrow('mimir timed out after 1s')
  })
})
