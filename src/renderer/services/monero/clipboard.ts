/**
 * Clipboard handling for secrets (exported Monero keys).
 *
 * A key copied to the clipboard stays there (and is visible to every other app, clipboard managers and sync tools)
 * until something else is copied. `copySecretWithAutoClear` writes the text and clears the clipboard again after
 * `XMR_CLIPBOARD_CLEAR_MS`, unless the user copied something else in the meantime. The timer lives outside of any
 * component, so closing the modal does not cancel it.
 */

/** The clipboard is cleared this long after a secret was copied */
export const XMR_CLIPBOARD_CLEAR_MS = 30_000

type ClipboardLike = {
  writeText: (text: string) => Promise<void>
  readText?: () => Promise<string>
}

let pending: ReturnType<typeof setTimeout> | undefined

/** Cancels a scheduled clear (tests) */
export const cancelPendingClipboardClear = (): void => {
  if (pending !== undefined) clearTimeout(pending)
  pending = undefined
}

const clearIfStillOurs = async (clipboard: ClipboardLike, text: string): Promise<void> => {
  try {
    const current = await clipboard.readText?.()
    // Something else was copied since: leave it alone
    if (current !== undefined && current !== text) return
  } catch {
    // Reading may be denied: clear anyway (a leaked key is worse than a lost clipboard entry)
  }
  try {
    await clipboard.writeText('')
  } catch {
    // nothing else we can do
  }
}

/** Copies `text` and clears the clipboard again after `delayMs`. Rejects when the copy itself fails. */
export const copySecretWithAutoClear = async (
  text: string,
  {
    clipboard = navigator.clipboard,
    delayMs = XMR_CLIPBOARD_CLEAR_MS
  }: { clipboard?: ClipboardLike; delayMs?: number } = {}
): Promise<void> => {
  await clipboard.writeText(text)
  cancelPendingClipboardClear()
  pending = setTimeout(() => {
    pending = undefined
    void clearIfStillOurs(clipboard, text)
  }, delayMs)
}
