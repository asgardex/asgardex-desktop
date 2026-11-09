import { sha256 } from '@noble/hashes/sha2'

import { cancelPendingClipboardClear, copySecretWithAutoClear, XMR_CLIPBOARD_CLEAR_MS } from './clipboard'
import { bytesToHex } from './derivation'

const sha256Hex = (text: string) => bytesToHex(sha256(new TextEncoder().encode(text)))

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

  describe('clearing through Electron main (works while the window is not focused)', () => {
    it('sends only the SHA-256 of the copied text to main, not the text, and does not need navigator', async () => {
      const { state, clipboard } = fakeClipboard()
      const main = { clearIfMatches: vi.fn().mockResolvedValue(true) }
      await copySecretWithAutoClear('secret-key', { clipboard, main })
      clipboard.writeText.mockClear()
      await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
      expect(main.clearIfMatches).toHaveBeenCalledTimes(1)
      expect(main.clearIfMatches).toHaveBeenCalledWith(sha256Hex('secret-key'))
      expect(JSON.stringify(main.clearIfMatches.mock.calls)).not.toContain('secret-key')
      expect(clipboard.readText).not.toHaveBeenCalled()
      expect(clipboard.writeText).not.toHaveBeenCalled()
      expect(state.text).toBe('secret-key') // (the fake main does not touch this fake clipboard)
    })

    it('main says "not ours anymore": nothing else is touched', async () => {
      const { state, clipboard } = fakeClipboard()
      const main = { clearIfMatches: vi.fn().mockResolvedValue(false) }
      const focusTarget = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
      await copySecretWithAutoClear('secret-key', { clipboard, main, focusTarget })
      state.text = 'something else'
      await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
      expect(state.text).toBe('something else')
      expect(focusTarget.addEventListener).not.toHaveBeenCalled()
    })

    it('main fails: falls back to navigator.clipboard', async () => {
      const { state, clipboard } = fakeClipboard()
      const main = { clearIfMatches: vi.fn().mockRejectedValue(new Error('no handler')) }
      await copySecretWithAutoClear('secret-key', { clipboard, main })
      await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
      expect(state.text).toBe('')
    })
  })

  describe('fallback: clear when the window regains focus', () => {
    const unfocusedClipboard = () => {
      const fake = fakeClipboard()
      const focused = { value: true }
      fake.clipboard.writeText.mockImplementation(async (t: string) => {
        if (!focused.value) throw new Error('Document is not focused.')
        fake.state.text = t
      })
      fake.clipboard.readText.mockImplementation(async () => {
        if (!focused.value) throw new Error('Document is not focused.')
        return fake.state.text
      })
      return { ...fake, focused }
    }

    it('no main API and navigator is rejected while unfocused: clears on the next focus', async () => {
      const { state, clipboard, focused } = unfocusedClipboard()
      const focusTarget = new EventTarget() as unknown as Window
      await copySecretWithAutoClear('secret-key', { clipboard, main: undefined, focusTarget })
      focused.value = false // user switched to another app
      await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
      expect(state.text).toBe('secret-key') // could not be cleared yet

      focused.value = true
      focusTarget.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
      expect(state.text).toBe('')
    })

    it('on focus it still leaves a different clipboard content alone', async () => {
      const { state, clipboard, focused } = unfocusedClipboard()
      const focusTarget = new EventTarget() as unknown as Window
      await copySecretWithAutoClear('secret-key', { clipboard, main: undefined, focusTarget })
      focused.value = false
      await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
      state.text = 'copied in another app'
      focused.value = true
      focusTarget.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
      expect(state.text).toBe('copied in another app')
    })

    it('the focus listener is removed once used and by a new copy', async () => {
      const { clipboard, focused } = unfocusedClipboard()
      const focusTarget = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
      await copySecretWithAutoClear('secret-key', { clipboard, main: undefined, focusTarget })
      focused.value = false
      await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
      expect(focusTarget.addEventListener).toHaveBeenCalledTimes(1)
      focused.value = true
      await copySecretWithAutoClear('second', { clipboard, main: undefined, focusTarget })
      expect(focusTarget.removeEventListener).toHaveBeenCalledWith(
        'focus',
        focusTarget.addEventListener.mock.calls[0][1]
      )
    })
  })
})
