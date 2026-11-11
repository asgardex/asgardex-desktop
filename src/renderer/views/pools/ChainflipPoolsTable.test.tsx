import { act } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { createRoot, Root } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { vi } from 'vitest'

import { ASSETS_MAINNET } from '../../../shared/mock/assets'
import en from '../../i18n/en'
import { ChainflipPoolsTable, ChainflipPoolsTableRow, Props, sortChainflipRows } from './ChainflipPoolsTable'

const row = (
  asset: ChainflipPoolsTableRow['asset'],
  priceUSD: number | undefined,
  overrides: Partial<ChainflipPoolsTableRow> = {}
): ChainflipPoolsTableRow => ({
  asset,
  chain: asset.chain,
  name: asset.ticker,
  symbol: asset.ticker,
  decimals: 8,
  minSwapAmount: '70000',
  priceUSD,
  boostAvailable: false,
  watched: false,
  ...overrides
})

const BTC = row(ASSETS_MAINNET.BTC, 97_123.45, { boostAvailable: true })
const ETH = row(ASSETS_MAINNET.ETH, 3_456.7, {
  decimals: 18,
  // above Number.MAX_SAFE_INTEGER in base units
  minSwapAmount: '10000000000000000',
  watched: true
})
const NO_PRICE = row(ASSETS_MAINNET.DOGE, undefined)

let root: Root
let container: HTMLDivElement

const render = (props: Partial<Props> = {}) => {
  const allProps: Props = {
    rows: [ETH, NO_PRICE, BTC],
    network: Network.Mainnet,
    onSwap: vi.fn(),
    onDetail: vi.fn(),
    onWatch: vi.fn(),
    onUnwatch: vi.fn(),
    ...props
  }
  act(() =>
    root.render(
      <IntlProvider locale="en" messages={en}>
        <ChainflipPoolsTable {...allProps} />
      </IntlProvider>
    )
  )
  return allProps
}

const rows = () => Array.from(container.querySelectorAll('[data-testid="chainflip-pools-table-row"]'))
const tickers = () => rows().map((tr) => tr.querySelectorAll('td')[1].querySelector('span')?.textContent)
const rowOf = (ticker: string) => rows().find((tr) => tr.querySelectorAll('td')[1].textContent?.startsWith(ticker))!
const buttonByLabel = (el: Element, label: string) =>
  Array.from(el.querySelectorAll('button')).find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label
  ) as HTMLButtonElement
const sortButton = (label: string) =>
  Array.from(container.querySelectorAll('thead button')).find((b) => b.textContent === label) as HTMLButtonElement

describe('views/pools/ChainflipPoolsTable', () => {
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

  it('renders only Chainflip fields: price, min swap (BigNumber), boost; no depth / volume / APY / status', () => {
    render()
    expect(tickers()).toEqual(['ETH', 'DOGE', 'BTC'])
    const heads = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent)
    expect(heads).toEqual([
      en['pools.watchlist'],
      en['common.asset'],
      en['common.price'],
      en['pools.chainflip.minSwap'],
      en['common.action']
    ])
    expect(rowOf('BTC').textContent).toContain('$97,123.45')
    expect(rowOf('BTC').textContent).toContain('0.0007 BTC')
    expect(rowOf('ETH').textContent).toContain('0.01 ETH')
    expect(rowOf('DOGE').textContent).toContain('—')
    expect(rowOf('BTC').querySelector('[data-testid="chainflip-boost"]')).not.toBeNull()
    expect(rowOf('ETH').querySelector('[data-testid="chainflip-boost"]')).toBeNull()
    expect(container.querySelector('[data-testid="pool-status-chip"]')).toBeNull()
    expect(container.textContent).not.toContain(en['pools.apy'])
    expect(container.textContent).not.toContain(en['common.liquidity'])
  })

  it('actions: Swap passes the row, chart opens detail, star toggles the watchlist; no Add', () => {
    const props = render()
    act(() => buttonByLabel(rowOf('BTC'), en['common.swap']).click())
    expect(props.onSwap).toHaveBeenCalledWith(BTC)
    act(() => buttonByLabel(rowOf('BTC'), en['pools.chart']).click())
    expect(props.onDetail).toHaveBeenCalledWith(BTC.asset)
    act(() => buttonByLabel(rowOf('BTC'), en['pools.watchlist.add']).click())
    expect(props.onWatch).toHaveBeenCalledWith(BTC.asset)
    act(() => buttonByLabel(rowOf('ETH'), en['pools.watchlist.remove']).click())
    expect(props.onUnwatch).toHaveBeenCalledWith(ETH.asset)
    expect(buttonByLabel(rowOf('BTC'), en['common.add'])).toBeUndefined()
  })

  it('sorts by price (unknown price last both ways) and by asset', () => {
    render()
    act(() => sortButton(en['common.price']).click())
    expect(tickers()).toEqual(['BTC', 'ETH', 'DOGE'])
    act(() => sortButton(en['common.price']).click())
    expect(tickers()).toEqual(['ETH', 'BTC', 'DOGE'])
    expect(sortButton(en['common.price']).closest('th')?.getAttribute('aria-sort')).toBe('ascending')
    act(() => sortButton(en['common.asset']).click())
    expect(tickers()).toEqual(['ETH', 'DOGE', 'BTC'])
    act(() => sortButton(en['common.asset']).click())
    expect(tickers()).toEqual(['BTC', 'DOGE', 'ETH'])
  })

  it('sortChainflipRows keeps the SDK order without a sort', () => {
    expect(sortChainflipRows([ETH, NO_PRICE, BTC], undefined)).toEqual([ETH, NO_PRICE, BTC])
  })

  it('loading shows skeleton rows; empty shows the given message, otherwise "no result"', () => {
    render({ rows: [], loading: true })
    expect(rows()).toHaveLength(0)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    render({ rows: [], emptyMessage: en['pools.chainflip.empty'] })
    expect(container.querySelector('tbody')?.textContent).toBe(en['pools.chainflip.empty'])
    render({ rows: [] })
    expect(container.querySelector('tbody')?.textContent).toBe(en['common.noResult'])
  })
})
