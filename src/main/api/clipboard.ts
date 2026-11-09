import { createHash, timingSafeEqual } from 'crypto'

import { clipboard } from 'electron'

/** Minimal subset of Electron's `clipboard` used here (injectable for tests) */
export type ClipboardLike = {
  readText: (type?: 'selection' | 'clipboard') => string
  clear: (type?: 'selection' | 'clipboard') => void
}

const SHA256_HEX = /^[0-9a-f]{64}$/

const sha256 = (text: string): Buffer => createHash('sha256').update(text, 'utf8').digest()

/** Linux has a second ("primary selection") clipboard; elsewhere `selection` is not available */
const hasSelection = (platform: NodeJS.Platform) => platform === 'linux'

/**
 * Clears the clipboard if it still contains the text with the given SHA-256 (lowercase hex).
 *
 * Used to remove a copied secret (exported Monero keys) after a timeout. Runs in main, so it also works while the
 * window is not focused (`navigator.clipboard` is rejected by Chromium then). The renderer only sends the hash and
 * gets a boolean back: the clipboard content never goes to the renderer, and nothing here is logged.
 */
export const clearClipboardIfMatches = (
  sha256Hex: unknown,
  {
    cb = clipboard as ClipboardLike,
    platform = process.platform
  }: { cb?: ClipboardLike; platform?: NodeJS.Platform } = {}
): boolean => {
  if (typeof sha256Hex !== 'string' || !SHA256_HEX.test(sha256Hex)) return false
  const expected = Buffer.from(sha256Hex, 'hex')
  const matches = (text: string) => text !== '' && timingSafeEqual(sha256(text), expected)

  let cleared = false
  if (matches(cb.readText('clipboard'))) {
    cb.clear('clipboard')
    cleared = true
  }
  if (hasSelection(platform) && matches(cb.readText('selection'))) {
    cb.clear('selection')
    cleared = true
  }
  return cleared
}
