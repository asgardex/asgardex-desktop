import { vi } from 'vitest'

const requests: Array<{ resolve: (id: string) => void; reject: (e: Error) => void }> = []
vi.mock('@xchainjs/xchain-mayachain', () => ({
  getChainId: vi.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        requests.push({ resolve, reject })
      })
  )
}))

const { getChainIdShared } = await import('./chainId')
const URL = 'https://node'

beforeEach(() => {
  vi.useFakeTimers()
  requests.length = 0
})
afterEach(async () => {
  await vi.advanceTimersByTimeAsync(10)
  vi.useRealTimers()
})

describe('services/mayachain/chainId', () => {
  it('shares one pending request between callers of the same turn', async () => {
    const a = getChainIdShared(URL)
    const b = getChainIdShared(URL)
    expect(requests.length).toBe(1)
    requests[0].resolve('maya-1')
    await expect(a).resolves.toBe('maya-1')
    await expect(b).resolves.toBe('maya-1')
    expect(requests.length).toBe(1)
  })

  it('a rejected shared request is not shared: the joining caller sends its own request', async () => {
    const first = getChainIdShared(URL) // e.g. keystore client
    const joined = getChainIdShared(URL) // e.g. read-only client
    requests[0].reject(new Error('429'))
    await expect(first).rejects.toThrow('429')
    await vi.advanceTimersByTimeAsync(0)
    expect(requests.length).toBe(2)
    requests[1].resolve('maya-1')
    await expect(joined).resolves.toBe('maya-1')
  })

  it('works the same with the callers the other way round', async () => {
    const first = getChainIdShared(URL) // e.g. read-only client
    const joined = getChainIdShared(URL) // e.g. keystore client
    requests[0].reject(new Error('500'))
    await expect(first).rejects.toThrow('500')
    await vi.advanceTimersByTimeAsync(0)
    requests[1].reject(new Error('500 again'))
    await expect(joined).rejects.toThrow('500 again')
    expect(requests.length).toBe(2)
  })

  it('a failed request is dropped at once, a later caller of the same turn asks again', async () => {
    const first = getChainIdShared(URL)
    requests[0].reject(new Error('429'))
    await expect(first).rejects.toThrow('429')
    const later = getChainIdShared(URL) // same turn (no timer has run)
    expect(requests.length).toBe(2)
    requests[1].resolve('maya-1')
    await expect(later).resolves.toBe('maya-1')
  })

  it('a later turn never reuses a request (e.g. a hanging one)', async () => {
    void getChainIdShared(URL)
    await vi.advanceTimersByTimeAsync(0)
    void getChainIdShared(URL)
    expect(requests.length).toBe(2)
  })
})
