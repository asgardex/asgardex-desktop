import { act, useState } from 'react'

import { createRoot, Root } from 'react-dom/client'
import { vi } from 'vitest'

import { SettingsRadioGroup } from './SettingsRadioGroup'

let root: Root
let container: HTMLDivElement

const options = [1, 1.5, 2].map((value) => ({ value, label: `${value}x` }))

const Controlled = ({ onChange }: { onChange: (value: number) => void }) => {
  const [value, setValue] = useState(1.5)
  return (
    <SettingsRadioGroup
      ariaLabel="Gas"
      options={options}
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

const radios = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
const checked = () => radios().find((r) => r.getAttribute('aria-checked') === 'true')?.textContent
const key = (el: HTMLElement, k: string) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  })

describe('components/settings/SettingsRadioGroup', () => {
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

  it('only the selected option is a tab stop', () => {
    act(() => root.render(<Controlled onChange={vi.fn()} />))
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Gas')
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1])
    expect(checked()).toBe('1.5x')
  })

  it('arrow keys move selection and focus (wrapping), Home / End jump', () => {
    const onChange = vi.fn()
    act(() => root.render(<Controlled onChange={onChange} />))
    key(radios()[1], 'ArrowRight')
    expect(checked()).toBe('2x')
    expect(document.activeElement).toBe(radios()[2])
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, -1, 0])
    key(radios()[2], 'ArrowDown')
    expect(checked()).toBe('1x')
    expect(document.activeElement).toBe(radios()[0])
    key(radios()[0], 'ArrowLeft')
    expect(checked()).toBe('2x')
    key(radios()[2], 'Home')
    expect(checked()).toBe('1x')
    key(radios()[0], 'End')
    expect(checked()).toBe('2x')
    expect(onChange.mock.calls.map(([v]) => v)).toEqual([2, 1, 2, 1, 2])
  })

  it('click selects; other keys do nothing', () => {
    const onChange = vi.fn()
    act(() => root.render(<Controlled onChange={onChange} />))
    key(radios()[1], 'a')
    expect(onChange).not.toHaveBeenCalled()
    act(() => radios()[0].click())
    expect(checked()).toBe('1x')
    expect(onChange).toHaveBeenCalledWith(1)
  })
})
