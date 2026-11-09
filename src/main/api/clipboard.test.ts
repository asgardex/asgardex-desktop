import { createHash } from 'crypto'

import { describe, expect, it, vi } from 'vitest'

import { clearClipboardIfMatches, ClipboardLike } from './clipboard'

vi.mock('electron', () => ({ clipboard: {} }))

// Dummy values only
const SECRET = 'dummy-secret-not-a-key'
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

const fakeClipboard = (initial: { clipboard?: string; selection?: string } = {}) => {
  const state = { clipboard: initial.clipboard ?? '', selection: initial.selection ?? '' }
  const cb: ClipboardLike & { readText: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> } = {
    readText: vi.fn((type: 'clipboard' | 'selection' = 'clipboard') => state[type]),
    clear: vi.fn((type: 'clipboard' | 'selection' = 'clipboard') => void (state[type] = ''))
  }
  return { state, cb }
}

describe('main/api/clipboard clearClipboardIfMatches', () => {
  it('clears the clipboard when it still holds the copied text', () => {
    const { state, cb } = fakeClipboard({ clipboard: SECRET })
    expect(clearClipboardIfMatches(hash(SECRET), { cb, platform: 'darwin' })).toBe(true)
    expect(state.clipboard).toBe('')
  })

  it('leaves the clipboard alone when something else was copied meanwhile', () => {
    const { state, cb } = fakeClipboard({ clipboard: 'something else' })
    expect(clearClipboardIfMatches(hash(SECRET), { cb, platform: 'darwin' })).toBe(false)
    expect(state.clipboard).toBe('something else')
    expect(cb.clear).not.toHaveBeenCalled()
  })

  it('does not clear an empty clipboard (nothing to compare)', () => {
    const { cb } = fakeClipboard()
    expect(clearClipboardIfMatches(hash(''), { cb, platform: 'darwin' })).toBe(false)
    expect(cb.clear).not.toHaveBeenCalled()
  })

  it('Linux: also clears a matching primary selection, and only that one if the clipboard changed', () => {
    const a = fakeClipboard({ clipboard: SECRET, selection: SECRET })
    expect(clearClipboardIfMatches(hash(SECRET), { cb: a.cb, platform: 'linux' })).toBe(true)
    expect(a.state).toEqual({ clipboard: '', selection: '' })

    const b = fakeClipboard({ clipboard: 'other', selection: SECRET })
    expect(clearClipboardIfMatches(hash(SECRET), { cb: b.cb, platform: 'linux' })).toBe(true)
    expect(b.state).toEqual({ clipboard: 'other', selection: '' })
  })

  it('does not touch the selection clipboard outside Linux', () => {
    const { cb } = fakeClipboard({ selection: SECRET })
    clearClipboardIfMatches(hash(SECRET), { cb, platform: 'win32' })
    expect(cb.readText).not.toHaveBeenCalledWith('selection')
  })

  it('rejects anything that is not a lowercase SHA-256 hex (e.g. the plain text itself)', () => {
    const { state, cb } = fakeClipboard({ clipboard: SECRET })
    for (const input of [SECRET, hash(SECRET).toUpperCase(), hash(SECRET).slice(1), '', 42, null, undefined, {}]) {
      expect(clearClipboardIfMatches(input, { cb, platform: 'darwin' })).toBe(false)
    }
    expect(state.clipboard).toBe(SECRET)
    expect(cb.readText).not.toHaveBeenCalled()
  })

  it('returns only a boolean (never the clipboard contents) and logs nothing', () => {
    const log = vi.spyOn(console, 'log')
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    const { cb } = fakeClipboard({ clipboard: 'unrelated text' })
    const result = clearClipboardIfMatches(hash(SECRET), { cb, platform: 'linux' })
    expect(typeof result).toBe('boolean')
    expect(log).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
})
