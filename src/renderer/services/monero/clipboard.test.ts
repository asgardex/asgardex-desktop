import { cancelPendingClipboardClear, copySecretWithAutoClear, XMR_CLIPBOARD_CLEAR_MS } from './clipboard'

const fakeClipboard = (initial = '') => {
  const state = { text: initial }
  return {
    state,
    clipboard: {
      writeText: vi.fn(async (t: string) => void (state.text = t)),
      readText: vi.fn(async () => state.text)
    }
  }
}

describe('services/monero/clipboard', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cancelPendingClipboardClear()
    vi.useRealTimers()
  })

  it('clears after about 30 seconds', async () => {
    expect(XMR_CLIPBOARD_CLEAR_MS).toBe(30_000)
    const { state, clipboard } = fakeClipboard()
    await copySecretWithAutoClear('secret-key', { clipboard })
    expect(state.text).toBe('secret-key')
    await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS - 1)
    expect(state.text).toBe('secret-key')
    await vi.advanceTimersByTimeAsync(1)
    expect(state.text).toBe('')
  })

  it('leaves the clipboard alone when the user copied something else meanwhile', async () => {
    const { state, clipboard } = fakeClipboard()
    await copySecretWithAutoClear('secret-key', { clipboard })
    state.text = 'something else'
    await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
    expect(state.text).toBe('something else')
  })

  it('clears anyway when the clipboard cannot be read (permission denied) or has no readText', async () => {
    const a = fakeClipboard()
    a.clipboard.readText.mockRejectedValue(new Error('denied'))
    await copySecretWithAutoClear('k1', { clipboard: a.clipboard })
    await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
    expect(a.state.text).toBe('')

    const b = fakeClipboard()
    await copySecretWithAutoClear('k2', { clipboard: { writeText: b.clipboard.writeText } })
    await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
    expect(b.state.text).toBe('')
  })

  it('a second copy restarts the timer (the first one does not clear the second)', async () => {
    const { state, clipboard } = fakeClipboard()
    await copySecretWithAutoClear('first', { clipboard })
    await vi.advanceTimersByTimeAsync(20_000)
    await copySecretWithAutoClear('second', { clipboard })
    await vi.advanceTimersByTimeAsync(20_000) // 40s after the first copy, 20s after the second
    expect(state.text).toBe('second')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(state.text).toBe('')
  })

  it('does not schedule anything (and rejects) when the copy fails', async () => {
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('no')), readText: vi.fn() }
    await expect(copySecretWithAutoClear('x', { clipboard })).rejects.toThrow('no')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not stop the timer when the caller goes away (it is not tied to a component)', async () => {
    const { state, clipboard } = fakeClipboard()
    await copySecretWithAutoClear('secret-key', { clipboard })
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
    expect(state.text).toBe('')
  })
})
