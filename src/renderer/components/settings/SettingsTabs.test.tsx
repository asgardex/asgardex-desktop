import { act } from 'react'

import { createRoot, Root } from 'react-dom/client'

import { SettingsTabs } from './SettingsTabs'

let root: Root
let container: HTMLDivElement

const tabs = [
  { key: 'general', label: 'General', content: <div>General panel</div> },
  { key: 'wallet', label: 'Wallet', content: <div>Wallet panel</div> },
  { key: 'dex', label: 'DEX', content: <div>DEX panel</div> }
]

const render = (defaultIndex = 0) => {
  act(() => {
    root.render(<SettingsTabs tabs={tabs} defaultIndex={defaultIndex} />)
  })
}

const tab = (label: string) =>
  Array.from(container.querySelectorAll('[role="tab"]')).find((el) => el.textContent === label) as HTMLButtonElement

describe('components/settings/SettingsTabs', () => {
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

  it('renders tab labels and marks the default tab as selected', () => {
    render(0)
    expect(Array.from(container.querySelectorAll('[role="tab"]')).map((el) => el.textContent)).toEqual([
      'General',
      'Wallet',
      'DEX'
    ])
    expect(tab('General').getAttribute('aria-selected')).toBe('true')
    expect(tab('Wallet').getAttribute('aria-selected')).toBe('false')
    expect(container.textContent).toContain('General panel')
    expect(container.textContent).not.toContain('Wallet panel')
  })

  it('shows the selected tab panel after a click', () => {
    render(0)
    act(() => tab('Wallet').click())
    expect(tab('Wallet').getAttribute('aria-selected')).toBe('true')
    expect(tab('General').getAttribute('aria-selected')).toBe('false')
    expect(container.textContent).toContain('Wallet panel')
    expect(container.textContent).not.toContain('General panel')
  })
})
