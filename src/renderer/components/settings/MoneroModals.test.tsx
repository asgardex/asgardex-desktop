import { createRoot, Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { IntlProvider } from 'react-intl'

import en from '../../i18n/en'
import { cancelPendingClipboardClear, XMR_CLIPBOARD_CLEAR_MS } from '../../services/monero/clipboard'
import type { XmrExportKeys } from '../../services/monero/derivation'
import { MoneroKeysModal, MoneroLwsConfirmModal, XMR_KEYS_MODAL_TIMEOUT_MS } from './MoneroModals'

const keys = { privateSpendKeyHex: 'aa'.repeat(32), privateViewKeyHex: 'bb'.repeat(32) } as unknown as XmrExportKeys

describe('components/settings/MoneroModals', () => {
  let container: HTMLDivElement
  let root: Root

  const render = (node: JSX.Element) =>
    act(() => {
      root.render(
        <IntlProvider locale="en" messages={en}>
          {node}
        </IntlProvider>
      )
    })

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    cancelPendingClipboardClear()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('LWS confirmation (L2)', () => {
    it('shows the redacted server (scheme, host, port) and the warning', () => {
      render(<MoneroLwsConfirmModal host="https://lws.example:8443" onConfirm={vi.fn()} onCancel={vi.fn()} />)
      const host = document.body.querySelector('[data-testid="monero-lws-confirm-host"]')
      expect(host?.textContent).toBe('Server: https://lws.example:8443')
      expect(document.body.textContent).toContain('ALL incoming payments')
    })
  })

  describe('exported keys', () => {
    it('shows both keys and says that it closes by itself and that the clipboard is cleared', () => {
      render(<MoneroKeysModal keys={keys} onClose={vi.fn()} />)
      expect(document.body.textContent).toContain(keys.privateSpendKeyHex)
      expect(document.body.textContent).toContain(keys.privateViewKeyHex)
      expect(document.body.querySelector('[data-testid="monero-keys-autoclose"]')?.textContent).toContain('60 seconds')
      expect(document.body.querySelector('[data-testid="monero-keys-autoclose"]')?.textContent).toContain('30 seconds')
    })

    it('warns that clipboard history tools keep their own copies', () => {
      render(<MoneroKeysModal keys={keys} onClose={vi.fn()} />)
      expect(document.body.textContent).toContain('Win+V')
      expect(document.body.textContent).toContain('keep their own copies')
    })

    it('the copy button clears through Electron main (hash only) when the preload API exists', async () => {
      const state = { text: '' }
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: async (t: string) => void (state.text = t),
          readText: async () => {
            throw new Error('Document is not focused.')
          }
        }
      })
      const clearIfMatches = vi.fn(async () => {
        state.text = ''
        return true
      })
      window.apiClipboard = { clearIfMatches }
      try {
        render(<MoneroKeysModal keys={keys} onClose={vi.fn()} />)
        const button = document.body.querySelector('[data-testid="monero-key-copy"]') as HTMLElement
        await act(async () => {
          button.click()
        })
        expect(state.text).toBe(keys.privateSpendKeyHex)
        await act(async () => {
          await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
        })
        expect(clearIfMatches).toHaveBeenCalledTimes(1)
        expect(clearIfMatches.mock.calls[0][0]).toMatch(/^[0-9a-f]{64}$/)
        expect(clearIfMatches.mock.calls[0][0]).not.toBe(keys.privateSpendKeyHex)
        expect(state.text).toBe('')
      } finally {
        delete window.apiClipboard
      }
    })

    it('closes itself after about 60 seconds (not before)', () => {
      expect(XMR_KEYS_MODAL_TIMEOUT_MS).toBe(60_000)
      const onClose = vi.fn()
      render(<MoneroKeysModal keys={keys} onClose={onClose} />)
      act(() => void vi.advanceTimersByTime(XMR_KEYS_MODAL_TIMEOUT_MS - 1))
      expect(onClose).not.toHaveBeenCalled()
      act(() => void vi.advanceTimersByTime(1))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('re-rendering (a new onClose function) does not restart the timer', () => {
      const first = vi.fn()
      const second = vi.fn()
      render(<MoneroKeysModal keys={keys} onClose={first} />)
      act(() => void vi.advanceTimersByTime(40_000))
      render(<MoneroKeysModal keys={keys} onClose={second} />)
      act(() => void vi.advanceTimersByTime(20_000))
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledTimes(1)
    })

    it('the timer is removed when the modal is closed earlier', () => {
      const onClose = vi.fn()
      render(<MoneroKeysModal keys={keys} onClose={onClose} />)
      act(() => root.render(<div />))
      act(() => void vi.advanceTimersByTime(XMR_KEYS_MODAL_TIMEOUT_MS * 2))
      expect(onClose).not.toHaveBeenCalled()
    })

    it('copying a key clears the clipboard after 30 seconds, even when the modal is gone by then', async () => {
      const state = { text: '' }
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: async (t: string) => void (state.text = t),
          readText: async () => state.text
        }
      })
      render(<MoneroKeysModal keys={keys} onClose={vi.fn()} />)
      const button = document.body.querySelector('[data-testid="monero-key-copy"]') as HTMLElement
      await act(async () => {
        button.click()
      })
      expect(state.text).toBe(keys.privateSpendKeyHex)

      act(() => root.render(<div />)) // modal closed
      await act(async () => {
        await vi.advanceTimersByTimeAsync(XMR_CLIPBOARD_CLEAR_MS)
      })
      expect(state.text).toBe('')
    })
  })
})
