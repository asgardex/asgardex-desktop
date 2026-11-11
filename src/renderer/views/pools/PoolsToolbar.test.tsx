import { act } from 'react'

import { option as O } from 'fp-ts'
import { createRoot, Root } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { vi } from 'vitest'

import en from '../../i18n/en'
import { DEFAULT_POOL_FILTERS, PoolFilter } from '../../services/midgard/midgardTypes'
import { PoolsToolbar } from './PoolsToolbar'

let root: Root
let container: HTMLDivElement

const render = ({
  activeFilter = O.none,
  refreshing = false
}: {
  activeFilter?: O.Option<PoolFilter>
  refreshing?: boolean
}) => {
  const setFilter = vi.fn()
  const onRefresh = vi.fn()
  act(() =>
    root.render(
      <IntlProvider locale="en" messages={en}>
        <PoolsToolbar
          poolFilters={DEFAULT_POOL_FILTERS}
          activeFilter={activeFilter}
          setFilter={setFilter}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      </IntlProvider>
    )
  )
  return { setFilter, onRefresh }
}

const segment = (label: string) =>
  Array.from(container.querySelectorAll('[role="radio"]')).find((b) => b.textContent === label) as HTMLButtonElement
const refreshButton = () => container.querySelector('button[aria-label="Refresh"]') as HTMLButtonElement

describe('views/pools/PoolsToolbar', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    root = createRoot(container)
  })
  afterEach(() => act(() => root.unmount()))

  it('renders all filters as segments and marks the active one', () => {
    render({ activeFilter: O.some('__usd__') })
    expect(Array.from(container.querySelectorAll('[role="radio"]')).map((b) => b.textContent)).toEqual([
      'All',
      'Watchlist',
      'Native',
      'Stablecoins',
      'AVAX',
      'ERC20',
      'BASE',
      'ARB'
    ])
    expect(segment('Stablecoins').getAttribute('aria-checked')).toBe('true')
    expect(segment('All').getAttribute('aria-checked')).toBe('false')
  })

  it('"All" is active without filter, and a search text is shown in the input', () => {
    render({ activeFilter: O.some('btc') })
    expect(segment('All').getAttribute('aria-checked')).toBe('false')
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('btc')
    render({ activeFilter: O.none })
    expect(segment('All').getAttribute('aria-checked')).toBe('true')
  })

  it('sets and clears filters', () => {
    const { setFilter } = render({})
    act(() => segment('Native').click())
    expect(setFilter).toHaveBeenLastCalledWith(O.some('__native__'))
    act(() => segment('All').click())
    expect(setFilter).toHaveBeenLastCalledWith(O.none)
  })

  it('refresh spins and is disabled while refreshing', () => {
    const idle = render({ refreshing: false })
    expect(refreshButton().disabled).toBe(false)
    expect(refreshButton().innerHTML).not.toContain('animate-spin')
    act(() => refreshButton().click())
    expect(idle.onRefresh).toHaveBeenCalled()

    render({ refreshing: true })
    expect(refreshButton().disabled).toBe(true)
    expect(refreshButton().innerHTML).toContain('animate-spin')
  })
})
