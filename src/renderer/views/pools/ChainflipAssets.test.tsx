import { act, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { assetToString } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { createRoot, Root } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import * as Rx from 'rxjs'
import { vi } from 'vitest'

import { ASSETS_MAINNET } from '../../../shared/mock/assets'
import { AssetBTC } from '../../../shared/utils/asset'
import { AssetUSDC, DEFAULT_WALLET_TYPE } from '../../const'
import en from '../../i18n/en'
import * as poolsRoutes from '../../routes/pools'
import { ChainflipAssetRowData } from '../../services/chainflip/poolData.types'
import { PoolFilter } from '../../services/midgard/midgardTypes'
import { ChainflipAssets } from './ChainflipAssets'

type RowsRD = RD.RemoteData<Error, ChainflipAssetRowData[]>

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  reload: vi.fn(),
  rows$: undefined as unknown as Rx.BehaviorSubject<RowsRD>
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('../../contexts/AppContext', () => ({ useAppContext: () => ({ network$: Rx.of(Network.Mainnet) }) }))
vi.mock('../../contexts/ChainflipContext', () => ({
  useChainflipContext: () => ({ chainflipAssetRows$: mocks.rows$, reloadChainflipAssetRows: mocks.reload })
}))
vi.mock('../../hooks/usePoolFilter', () => ({
  usePoolFilter: () => {
    const [filter, setFilter] = useState<O.Option<PoolFilter>>(O.none)
    return { filter, setFilter }
  }
}))
vi.mock('../../hooks/usePoolWatchlist', () => ({
  usePoolWatchlist: () => ({ add: vi.fn(), remove: vi.fn(), list: [] })
}))

const row = (asset: ChainflipAssetRowData['asset'], priceUSD: number): ChainflipAssetRowData => ({
  asset,
  chain: asset.chain,
  name: asset.ticker,
  symbol: asset.ticker,
  decimals: 8,
  minSwapAmount: '70000',
  priceUSD,
  boostAvailable: false
})
const BTC = row(ASSETS_MAINNET.BTC, 97_000)
const ETH = row(ASSETS_MAINNET.ETH, 3_400)

let root: Root
let container: HTMLDivElement

const render = () =>
  act(() =>
    root.render(
      <IntlProvider locale="en" messages={en}>
        <ChainflipAssets />
      </IntlProvider>
    )
  )
const emit = (rd: RowsRD) => act(() => mocks.rows$.next(rd))
const tickers = () =>
  Array.from(container.querySelectorAll('[data-testid="chainflip-pools-table-row"]')).map(
    (tr) => tr.querySelectorAll('td')[1].querySelector('span')?.textContent
  )
const refreshButton = () => container.querySelector(`button[aria-label="${en['common.refresh']}"]`) as HTMLButtonElement

describe('views/pools/ChainflipAssets', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    mocks.rows$ = new Rx.BehaviorSubject<RowsRD>(RD.pending)
    mocks.navigate.mockReset()
    mocks.reload.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('initial load: modern toolbar + skeleton rows, then the Chainflip rows', () => {
    render()
    expect(container.querySelector('[data-testid="chainflip-pools-table"]')).not.toBeNull()
    expect(container.querySelector('input[type="search"]')).not.toBeNull()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    emit(RD.success([BTC, ETH]))
    expect(tickers()).toEqual(['BTC', 'ETH'])
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0)
  })

  it('refresh: calls the Chainflip reload and keeps the rows (spinning, disabled) until new data arrives', () => {
    render()
    emit(RD.success([BTC, ETH]))
    act(() => refreshButton().click())
    expect(mocks.reload).toHaveBeenCalledTimes(1)
    emit(RD.pending)
    expect(tickers()).toEqual(['BTC', 'ETH'])
    expect(refreshButton().disabled).toBe(true)
    expect(refreshButton().querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    emit(RD.success([ETH]))
    expect(tickers()).toEqual(['ETH'])
    expect(refreshButton().disabled).toBe(false)
  })

  it('search filters rows; "no result" for no match, Chainflip empty message only without any asset', () => {
    render()
    emit(RD.success([BTC, ETH]))
    const input = container.querySelector('input[type="search"]') as HTMLInputElement
    const type = (value: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    type('eth')
    expect(tickers()).toEqual(['ETH'])
    type('xyz')
    expect(container.querySelector('tbody')?.textContent).toBe(en['common.noResult'])
    type('')
    emit(RD.success([]))
    expect(container.querySelector('tbody')?.textContent).toBe(en['pools.chainflip.empty'])
  })

  it('error: error view with a refresh that reloads Chainflip rows', () => {
    render()
    emit(RD.failure(Error('chainflip down')))
    expect(container.textContent).toContain('chainflip down')
    expect(container.querySelector('[data-testid="chainflip-pools-table"]')).toBeNull()
    const reload = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(en['common.refresh'])
    ) as HTMLButtonElement
    act(() => reload.click())
    expect(mocks.reload).toHaveBeenCalledTimes(1)
  })

  it('Swap and chart keep their routes (USDC target, BTC for USDC; pool detail)', () => {
    render()
    const USDC = row(AssetUSDC, 1)
    emit(RD.success([BTC, USDC]))
    const rowOf = (ticker: string) =>
      Array.from(container.querySelectorAll('[data-testid="chainflip-pools-table-row"]')).find(
        (tr) => tr.querySelectorAll('td')[1].querySelector('span')?.textContent === ticker
      ) as HTMLElement
    const swap = (tr: HTMLElement) =>
      act(() =>
        (
          Array.from(tr.querySelectorAll('button')).find(
            (b) => b.textContent === en['common.swap']
          ) as HTMLButtonElement
        ).click()
      )
    const swapPath = (source: string, target: string) =>
      poolsRoutes.swap.path({
        source,
        target,
        sourceWalletType: DEFAULT_WALLET_TYPE,
        targetWalletType: DEFAULT_WALLET_TYPE
      })
    swap(rowOf('BTC'))
    expect(mocks.navigate).toHaveBeenLastCalledWith(swapPath(assetToString(BTC.asset), assetToString(AssetUSDC)))
    swap(rowOf('USDC'))
    expect(mocks.navigate).toHaveBeenLastCalledWith(swapPath(assetToString(AssetUSDC), assetToString(AssetBTC)))
    act(() => (rowOf('BTC').querySelector(`button[aria-label="${en['pools.chart']}"]`) as HTMLButtonElement).click())
    expect(mocks.navigate).toHaveBeenLastCalledWith(poolsRoutes.detail.path({ asset: assetToString(BTC.asset) }))
  })
})
