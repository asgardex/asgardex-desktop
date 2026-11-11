import { act } from 'react'

import { createRoot, Root } from 'react-dom/client'
import { vi } from 'vitest'

import { SettingsSelect } from './SettingsSelect'

let root: Root
let container: HTMLDivElement

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const open = async () => {
  const button = container.querySelector('button') as HTMLButtonElement
  await act(async () => {
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
  await flush()
}

const items = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))

describe('components/settings/SettingsSelect', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('keyboard: Enter on an option selects it (handler runs on the activated menu item)', async () => {
    const onSelect = vi.fn()
    act(() => root.render(<SettingsSelect value="English" options={['English', 'Deutsch']} onSelect={onSelect} />))
    await open()
    expect(items().map((i) => i.textContent)).toEqual(['English', 'Deutsch'])
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    await act(async () => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    await act(async () => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await flush()
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('mouse: a click inside an option selects it once', async () => {
    const onSelect = vi.fn()
    act(() =>
      root.render(
        <SettingsSelect
          value="Mainnet"
          options={[<span key="m">Mainnet</span>, <span key="s">Stagenet</span>]}
          onSelect={onSelect}
        />
      )
    )
    await open()
    const inner = items()[1].querySelector('span') as HTMLElement
    await act(async () => {
      inner.click()
    })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
