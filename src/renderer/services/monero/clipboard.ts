import { sha256 } from '@noble/hashes/sha2'

import type { ApiClipboard } from '../../../shared/api/types'
import { bytesToHex } from './derivation'

/**
 * Clipboard handling for secrets (exported Monero keys).
 *
 * A key copied to the clipboard stays there (and is visible to every other app, clipboard managers and sync tools)
 * until something else is copied. `copySecretWithAutoClear` writes the text and clears the clipboard again after
 * `XMR_CLIPBOARD_CLEAR_MS`, unless the user copied something else in the meantime.
 *
 * The clear goes through Electron's main process (`window.apiClipboard`): Chromium rejects `navigator.clipboard` while
 * the document is not focused — the normal case while the user pastes the key into another app. Only a SHA-256 of
 * the copied text is kept and sent to main; main compares it and never returns the clipboard contents.
 * Fallback (no main API, or it failed): `navigator.clipboard`, and if that is rejected too, again as soon as the window
 * regains focus.
 *
 * The timer lives outside of any component, so closing the modal does not cancel it.
 */

/** The clipboard is cleared this long after a secret was copied */
export const XMR_CLIPBOARD_CLEAR_MS = 30_000

type ClipboardLike = {
  writeText: (text: string) => Promise<void>
  readText?: () => Promise<string>
}

type FocusTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>

const hashText = (text: string): string => bytesToHex(sha256(new TextEncoder().encode(text)))

let pending: ReturnType<typeof setTimeout> | undefined
let removeFocusListener: (() => void) | undefined

/** Cancels a scheduled clear, including a pending on-focus fallback (also used by tests) */
export const cancelPendingClipboardClear = (): void => {
  if (pending !== undefined) clearTimeout(pending)
  pending = undefined
  removeFocusListener?.()
  removeFocusListener = undefined
}

/**
 * Renderer fallback. Resolves `true` when there is nothing left to do (cleared, or something else was copied),
 * `false` when the clipboard could not be accessed (e.g. document not focused).
 */
const clearViaRenderer = async (clipboard: ClipboardLike, hash: string): Promise<boolean> => {
  try {
    const current = await clipboard.readText?.()
    // Something else was copied since: leave it alone
    if (current !== undefined && hashText(current) !== hash) return true
  } catch {
    // Reading may be denied: try to clear anyway (a leaked key is worse than a lost clipboard entry)
  }
  try {
    await clipboard.writeText('')
    return true
  } catch {
    return false
  }
}

const clearViaMain = async (main: ApiClipboard | undefined, hash: string): Promise<boolean> => {
  if (!main) return false
  try {
    await main.clearIfMatches(hash) // `false` = not ours anymore: also done
    return true
  } catch {
    return false
  }
}

/** Copies `text` and clears the clipboard again after `delayMs`. Rejects when the copy itself fails. */
export const copySecretWithAutoClear = async (
  text: string,
  {
    clipboard = navigator.clipboard,
    main = typeof window !== 'undefined' ? window.apiClipboard : undefined,
    focusTarget = typeof window !== 'undefined' ? window : undefined,
    delayMs = XMR_CLIPBOARD_CLEAR_MS
  }: { clipboard?: ClipboardLike; main?: ApiClipboard; focusTarget?: FocusTarget; delayMs?: number } = {}
): Promise<void> => {
  await clipboard.writeText(text)
  cancelPendingClipboardClear()
  // Only the hash is kept for the scheduled clear, not the secret itself
  const hash = hashText(text)

  const armFocusFallback = () => {
    if (!focusTarget) return
    const onFocus = () => {
      cancelPendingClipboardClear()
      void clearViaRenderer(clipboard, hash)
    }
    focusTarget.addEventListener('focus', onFocus)
    removeFocusListener = () => focusTarget.removeEventListener('focus', onFocus)
  }

  pending = setTimeout(() => {
    pending = undefined
    void (async () => {
      if (await clearViaMain(main, hash)) return
      if (await clearViaRenderer(clipboard, hash)) return
      armFocusFallback()
    })()
  }, delayMs)
}
