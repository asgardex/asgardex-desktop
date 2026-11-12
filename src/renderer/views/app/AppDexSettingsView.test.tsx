import { act } from 'react'

import { createRoot, Root } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { vi } from 'vitest'

import { Locale } from '../../../shared/i18n/types'
import { getMessagesByLocale } from '../../i18n'
import { AppDexSettingsView } from './AppDexSettingsView'

const mocks = vi.hoisted(() => {
  // vi.hoisted runs before imports, so this cannot construct an rxjs BehaviorSubject.
  // useObservableState treats an object as an observable when it has lift and subscribe,
  // and reads `.value` for the first render.
  const slip$ = (value: number) => ({
    value,
    lift() {
      return this
    },
    subscribe(observer: { next?: (value: number) => void }) {
      observer.next?.(value)
      return { unsubscribe() {} }
    }
  })
  return {
    streaming$: slip$(3),
    trade$: slip$(1),
    changeStreaming: vi.fn(),
    changeTrade: vi.fn(),
    setAggProtocol: vi.fn()
  }
})

vi.mock('../../contexts/AppContext', () => ({
  useAppContext: () => ({
    streamingSlipTolerance$: mocks.streaming$,
    changeStreamingSlipTolerance: mocks.changeStreaming,
    tradeSlipTolerance$: mocks.trade$,
    changeTradeSlipTolerance: mocks.changeTrade
  })
}))

vi.mock('../../store/aggregator/hooks', () => ({
  useAggregator: () => ({
    protocols: ['Thorchain'],
    setAggProtocol: mocks.setAggProtocol
  })
}))

const messages = getMessagesByLocale(Locale.EN)

let root: Root
let container: HTMLDivElement

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const trigger = (label: string) =>
  Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(label)
  ) as HTMLButtonElement

const items = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))

describe('views/app/AppDexSettingsView', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    mocks.changeStreaming.mockClear()
    mocks.changeTrade.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root.render(
        <IntlProvider locale="en" messages={messages}>
          <AppDexSettingsView />
        </IntlProvider>
      )
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const choose = async (label: string, presses: number) => {
    await act(async () => {
      trigger(label).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await flush()
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    for (let i = 0; i < presses; i += 1) {
      await act(async () => {
        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      })
    }
    await act(async () => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await flush()
  }

  it('Enter on a streaming option selects it', async () => {
    await choose('3 %', 2)
    expect(items().map((item) => item.textContent)).toEqual([])
    expect(mocks.changeStreaming).toHaveBeenCalledTimes(1)
    expect(mocks.changeStreaming).toHaveBeenCalledWith(5)
    expect(localStorage.getItem('asgdx-slip-tolerance_STREAMING')).toBe('5')
    expect(mocks.changeTrade).not.toHaveBeenCalled()
  })

  it('Enter on a trade option selects it', async () => {
    await choose('1 %', 2)
    expect(mocks.changeTrade).toHaveBeenCalledTimes(1)
    expect(mocks.changeTrade).toHaveBeenCalledWith(3)
    expect(localStorage.getItem('asgdx-slip-tolerance_TRADE')).toBe('3')
    expect(mocks.changeStreaming).not.toHaveBeenCalled()
  })
})
