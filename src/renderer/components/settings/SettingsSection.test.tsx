import { act } from 'react'

import { createRoot, Root } from 'react-dom/client'

import { SettingsSection, SettingsSubsection } from './SettingsSection'

let root: Root
let container: HTMLDivElement

const render = (node: JSX.Element) => {
  act(() => {
    root.render(node)
  })
}

describe('components/settings/SettingsSection', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    root = createRoot(container)
  })
  afterEach(() => act(() => root.unmount()))

  it('renders title, subtitle, action and children', () => {
    render(
      <SettingsSection title="Network" subtitle="Network to connect to" action={<button type="button">Mainnet</button>}>
        <span>extra</span>
      </SettingsSection>
    )
    const section = container.querySelector('[data-testid="settings-section"]') as HTMLElement
    expect(section.querySelector('h2')?.textContent).toBe('Network')
    expect(section.querySelector('p')?.textContent).toBe('Network to connect to')
    expect(container.querySelector('button')?.textContent).toBe('Mainnet')
    expect(section.textContent).toContain('extra')
  })

  it('omits the subtitle when it is not provided', () => {
    render(<SettingsSection title="Language" />)
    const section = container.querySelector('[data-testid="settings-section"]') as HTMLElement
    expect(section.querySelector('h2')?.textContent).toBe('Language')
    expect(section.querySelector('p')).toBeNull()
  })

  it('renders a subsection title and optional warning', () => {
    render(
      <SettingsSubsection title="Midgard" warning warningTooltip="Unhealthy">
        <input aria-label="url" />
      </SettingsSubsection>
    )
    const subsection = container.querySelector('[data-testid="settings-subsection"]') as HTMLElement
    expect(subsection.querySelector('h3')?.textContent).toBe('Midgard')
    expect(subsection.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('input')).not.toBeNull()
  })
})
