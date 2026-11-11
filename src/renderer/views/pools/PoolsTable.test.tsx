import { act } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, assetAmount, assetToBase } from '@xchainjs/xchain-util'
import { createRoot, Root } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { vi } from 'vitest'

import { ASSETS_MAINNET } from '../../../shared/mock/assets'
import en from '../../i18n/en'
import { GetPoolsStatusEnum } from '../../services/midgard/midgardTypes'
import { PoolsTable, PoolsTableRow, Props } from './PoolsTable'

const USD: AnyAsset = ASSETS_MAINNET.USDT

const row = (asset: AnyAsset, depth: number, overrides: Partial<PoolsTableRow> = {}): PoolsTableRow => ({
  asset,
  poolPrice: assetToBase(assetAmount(depth / 10)),
  depthAmount: assetToBase(assetAmount(0)),
  depthPrice: assetToBase(assetAmount(depth)),
  volumeAmount: assetToBase(assetAmount(0)),
  volumePrice: assetToBase(assetAmount(depth * 2)),
  apy: 5.284,
  status: GetPoolsStatusEnum.Available,
  key: asset.ticker,
  network: Network.Mainnet,
  watched: false,
  ...overrides
})

const BTC_ROW = row(ASSETS_MAINNET.BTC, 27_614_000, {
  poolStatus: { kind: 'deposit' }
})
const ETH_ROW = row(ASSETS_MAINNET.ETH, 8_090_000, { watched: true })
const DOGE_ROW = row(ASSETS_MAINNET.DOGE, 1_780_000, { poolStatus: { kind: 'trading' } })

let root: Root
let container: HTMLDivElement

const render = (props: Partial<Props> = {}) => {
  const allProps: Props = {
    variant: 'active',
    rows: [DOGE_ROW, BTC_ROW, ETH_ROW],
    pricePoolAsset: USD,
    network: Network.Mainnet,
    apyPeriodLabel: '30D',
    onSwap: vi.fn(),
    onAdd: vi.fn(),
    onDetail: vi.fn(),
    onWatch: vi.fn(),
    onUnwatch: vi.fn(),
    ...props
  }
  act(() =>
    root.render(
      <IntlProvider locale="en" messages={en}>
        <PoolsTable {...allProps} />
      </IntlProvider>
    )
  )
  return allProps
}

const rowTexts = () =>
  Array.from(container.querySelectorAll('[data-testid="pools-table-row"]')).map(
    (tr) => tr.querySelectorAll('td')[1].textContent ?? ''
  )
const button = (tr: Element, label: string) =>
  Array.from(tr.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement
const rowOf = (ticker: string) =>
  Array.from(container.querySelectorAll('[data-testid="pools-table-row"]')).find((tr) =>
    tr.querySelectorAll('td')[1].textContent?.startsWith(ticker)
  ) as Element

describe('views/pools/PoolsTable', () => {
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

  it('renders formatted, right aligned values sorted by liquidity', () => {
    render()
    expect(rowTexts().map((text) => text.slice(0, 3))).toEqual(['BTC', 'ETH', 'DOG'])
    const cells = rowOf('BTC').querySelectorAll('td')
    expect(cells[3].textContent).toBe('$2,761,400.00')
    expect(cells[4].textContent).toBe('$27.61M')
    expect(cells[5].textContent).toBe('$55.23M')
    expect(cells[6].textContent).toBe('5.28%')
    expect(container.textContent).toContain('APY 30D')
  })

  it('sorts by a column and toggles the direction', () => {
    render()
    const sortButton = (label: string) =>
      Array.from(container.querySelectorAll('thead button')).find((b) => b.textContent === label) as HTMLButtonElement
    act(() => sortButton('Pool').click())
    expect(rowTexts().map((text) => text.slice(0, 3))).toEqual(['ETH', 'DOG', 'BTC'])
    expect(sortButton('Pool').closest('th')?.getAttribute('aria-sort')).toBe('descending')
    act(() => sortButton('Pool').click())
    expect(rowTexts().map((text) => text.slice(0, 3))).toEqual(['BTC', 'DOG', 'ETH'])
    expect(sortButton('Pool').closest('th')?.getAttribute('aria-sort')).toBe('ascending')
  })

  it('shows a status column and disables actions by status', () => {
    const props = render()
    const btc = rowOf('BTC')
    expect(btc.querySelector('[data-testid="pool-status-chip"]')?.textContent).toBe('Deposits paused')
    // status sits between Pool and Price, not in the Pool cell and not after the numbers
    const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent?.trim())
    expect(headers.slice(1, 4)).toEqual(['Pool', 'Status', 'Price'])
    expect(btc.querySelectorAll('td')[1].querySelector('[data-testid="pool-status-chip"]')).toBeNull()
    expect(btc.querySelectorAll('td')[2].querySelector('[data-testid="pool-status-chip"]')).not.toBeNull()
    // deposit pause: swap works, add is disabled with its reason
    expect(button(btc, 'Swap').getAttribute('aria-disabled')).toBe('false')
    expect(button(btc, 'Add').getAttribute('aria-disabled')).toBe('true')
    expect(button(btc, 'Add').getAttribute('aria-label')).toContain('New deposits to this pool are paused')
    act(() => button(btc, 'Add').click())
    expect(props.onAdd).not.toHaveBeenCalled()
    act(() => button(btc, 'Swap').click())
    expect(props.onSwap).toHaveBeenCalledWith(ASSETS_MAINNET.BTC)

    // trading halt: swap and add are disabled
    const doge = rowOf('DOGE')
    expect(doge.querySelector('[data-testid="pool-status-chip"]')?.getAttribute('data-status')).toBe('trading')
    expect(button(doge, 'Swap').getAttribute('aria-disabled')).toBe('true')
    expect(button(doge, 'Add').getAttribute('aria-disabled')).toBe('true')

    // no status: a neutral dash in the status column, all actions enabled
    const eth = rowOf('ETH')
    expect(eth.querySelector('[data-testid="pool-status-chip"]')).toBeNull()
    expect(eth.querySelectorAll('td')[2].textContent).toBe('--')
    act(() => button(eth, 'Add').click())
    expect(props.onAdd).toHaveBeenCalledWith(ASSETS_MAINNET.ETH)
  })

  it('unknown status (halt data not loaded): neutral chip, swap and add disabled with the reason', () => {
    const props = render({ rows: [row(ASSETS_MAINNET.ETH, 1_000, { poolStatus: { kind: 'unknown' } })] })
    const eth = rowOf('ETH')
    const chip = eth.querySelector('[data-testid="pool-status-chip"]')
    expect(chip?.getAttribute('data-status')).toBe('unknown')
    expect(chip?.textContent).toBe('Status unknown')
    expect(chip?.querySelector('.bg-warning0')).toBeNull()
    expect(button(eth, 'Swap').getAttribute('aria-disabled')).toBe('true')
    expect(button(eth, 'Add').getAttribute('aria-disabled')).toBe('true')
    expect(button(eth, 'Swap').getAttribute('aria-label')).toContain('Halt status could not be loaded')
    act(() => button(eth, 'Swap').click())
    act(() => button(eth, 'Add').click())
    expect(props.onSwap).not.toHaveBeenCalled()
    expect(props.onAdd).not.toHaveBeenCalled()
  })

  it('toggles the watchlist', () => {
    const props = render()
    act(() => (rowOf('ETH').querySelector('button[aria-pressed]') as HTMLButtonElement).click())
    expect(props.onUnwatch).toHaveBeenCalledWith(ASSETS_MAINNET.ETH)
    act(() => (rowOf('BTC').querySelector('button[aria-pressed]') as HTMLButtonElement).click())
    expect(props.onWatch).toHaveBeenCalledWith(ASSETS_MAINNET.BTC)
  })

  it('renders pending pools with blocks left and add only', () => {
    render({ variant: 'pending', getBlocksLeft: ({ asset }) => (asset.ticker === 'BTC' ? '1,234' : '--') })
    const btc = rowOf('BTC')
    expect(btc.querySelectorAll('td')[5].textContent).toBe('1,234')
    expect(button(btc, 'Swap')).toBeUndefined()
    expect(button(btc, 'Add')).toBeDefined()
    expect(container.textContent).not.toContain('APY')
    expect(container.textContent).toContain('blocks left')
  })

  it('renders a skeleton while loading and a message without rows', () => {
    render({ rows: [], loading: true })
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    render({ rows: [], loading: false })
    expect(container.textContent).toContain('No result')
  })
})
