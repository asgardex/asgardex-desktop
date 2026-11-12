/**
 * The LP "Manage" button is the wallet's way into the withdraw form. It must follow the same rule as the
 * withdraw form (THORNode / MAYANode withdraw handler: chain halt or LP pause only), so an unknown halt status
 * (a failed lastblock or inbound_addresses request) does not lock every LP position.
 *
 * Renders the real PoolShareView, PoolShares table and halt hooks; only data sources are mocked.
 * Halt data is the captured mainnet mimir from hooks/__fixtures__.
 */
import { act, createElement } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, assetFromStringEx, baseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { option as O } from 'fp-ts'
import { createRoot, Root } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { MemoryRouter } from 'react-router-dom'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PoolShareTableRowData } from '../../components/PoolShares/PoolShares.types'
import mayaMimir from '../../hooks/__fixtures__/mayanode-mainnet-btc-eth-zec-trading-halted/mimir.json'
import thorMimir from '../../hooks/__fixtures__/thornode-mainnet-chains-halted-lp-paused/mimir.json'
import en from '../../i18n/en'
import { PoolShareView } from './PoolShareView'

const THOR_HEIGHT = 28483475
const MAYA_HEIGHT = 19095919

const mocks = vi.hoisted(() => ({
  protocol: 'THOR',
  rows: [] as unknown[],
  thorchain: {} as Record<string, unknown>,
  mayachain: {} as Record<string, unknown>,
  haltedChains$: undefined as unknown
}))

vi.mock('../../contexts/ThorchainContext', () => ({ useThorchainContext: () => mocks.thorchain }))
vi.mock('../../contexts/MayachainContext', () => ({ useMayachainContext: () => mocks.mayachain }))
vi.mock('../../services/storage/userChains', async () => {
  const { of } = await import('rxjs')
  return { userChains$: of(['BTC', 'AVAX', 'DASH', 'THOR', 'MAYA']) }
})
const { midgard } = vi.hoisted(() => ({
  midgard: async () => {
    const { of } = await import('rxjs')
    const RDm = await import('@devexperts/remote-data-ts')
    const { option } = await import('fp-ts')
    return {
      service: {
        pools: {
          allPoolDetails$: of(RDm.success([])),
          poolsState$: of(RDm.success({})),
          selectedPricePool$: of({ poolData: undefined }),
          selectedPricePoolAsset$: of(option.none),
          reloadAllPools: () => {},
          // inbound_addresses failed: halted chains unknown
          get haltedChains$() {
            return mocks.haltedChains$
          }
        },
        reloadNetworkInfo: () => {}
      }
    }
  }
}))
vi.mock('../../contexts/MidgardContext', async () => {
  const value = await midgard()
  return { useMidgardContext: () => value }
})
vi.mock('../../contexts/MidgardMayaContext', async () => {
  const value = await midgard()
  return { useMidgardMayaContext: () => value }
})
vi.mock('../../contexts/ChainContext', () => ({ useChainContext: () => ({ addressByChain$: () => Rx.of(O.none) }) }))
vi.mock('../../contexts/WalletContext', () => ({
  useWalletContext: () => ({ appWalletService: { getCurrentWalletType: () => 'keystore' } })
}))
vi.mock('../../hooks/useNetwork', () => ({ useNetwork: () => ({ network: 'mainnet' }) }))
vi.mock('../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ lg: true, xl: false }) }))
vi.mock('../../store/app/hooks', () => ({
  useApp: () => ({ isPrivate: false, protocol: mocks.protocol, setProtocol: () => {} })
}))
vi.mock('../../hooks/usePoolShares', async () => {
  const RDm = await import('@devexperts/remote-data-ts')
  return { usePoolShares: () => ({ allSharesRD: RDm.success([]) }) }
})
vi.mock('./PoolShareView.helper', () => ({ getPoolShareTableData: () => mocks.rows }))
vi.mock('../../components/wallet/assets', () => ({ AssetsNav: () => null, TotalAssetValue: () => null }))
vi.mock('../../components/uielements/protocolSwitch', () => ({ ProtocolSwitch: () => null }))

const row = (asset: AnyAsset): PoolShareTableRowData => ({
  asset,
  runeShare: baseAmount(1),
  assetShare: baseAmount(1),
  sharePercent: new BigNumber(1),
  assetDepositPrice: baseAmount(1),
  runeDepositPrice: baseAmount(1),
  type: 'sym'
})

const lastblockDown = RD.failure(Error('lastblock down'))
const inboundDown = RD.failure<Error, string[]>(Error('inbound_addresses down'))

let root: Root
let container: HTMLDivElement

const setupThor = (mimir: Record<string, number>, lastblock: RD.RemoteData<Error, unknown>) => {
  mocks.protocol = 'THOR'
  mocks.thorchain = { mimir$: Rx.of(RD.success(mimir)), thorchainLastblockState$: Rx.of(lastblock) }
}
const setupMaya = (mimir: Record<string, number>, lastblock: RD.RemoteData<Error, unknown>) => {
  mocks.protocol = 'MAYA'
  mocks.mayachain = { mimir$: Rx.of(RD.success(mimir)), mayachainLastblockState$: Rx.of(lastblock) }
}
const thorBlock = RD.success([{ chain: 'BTC', thorchain: THOR_HEIGHT }])
const mayaBlock = RD.success([{ chain: 'BTC', mayachain: MAYA_HEIGHT }])

const render = (assets: string[]) => {
  mocks.rows = assets.map((a) => row(assetFromStringEx(a)))
  act(() =>
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(IntlProvider, { locale: 'en', messages: en }, createElement(PoolShareView))
      )
    )
  )
}

/** Manage button of the table row showing `ticker` */
const manageDisabled = (ticker: string): boolean => {
  const tr = Array.from(container.querySelectorAll('tbody tr')).find((r) => r.textContent?.includes(ticker))
  const buttons = tr ? Array.from(tr.querySelectorAll('button')) : []
  const button = buttons[buttons.length - 1]
  if (!button) throw Error(`no Manage button for ${ticker}`)
  return button.disabled
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  mocks.haltedChains$ = Rx.of(RD.success([]))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('PoolShareView: LP Manage button (THORChain)', () => {
  it('halt status unknown (lastblock and inbound_addresses failed): Manage stays enabled', () => {
    mocks.haltedChains$ = Rx.of(inboundDown)
    setupThor(thorMimir, lastblockDown)
    render(['AVAX.AVAX'])
    expect(manageDisabled('AVAX')).toBe(false)
  })

  it('guard: a proven chain halt (fixture HALTBTCCHAIN = 1) disables Manage, also while status is unknown', () => {
    mocks.haltedChains$ = Rx.of(inboundDown)
    setupThor(thorMimir, lastblockDown)
    render(['BTC.BTC', 'AVAX.AVAX'])
    expect(manageDisabled('BTC')).toBe(true)
  })

  it('a proven LP pause (PAUSELPAVAX) disables Manage (missed before: only chain halts were checked)', () => {
    setupThor({ ...thorMimir, PAUSELPAVAX: 1 }, thorBlock)
    render(['AVAX.AVAX'])
    expect(manageDisabled('AVAX')).toBe(true)
  })

  it('guard: known status without a halt keeps Manage enabled', () => {
    setupThor(thorMimir, thorBlock)
    render(['AVAX.AVAX'])
    expect(manageDisabled('AVAX')).toBe(false)
  })
})

describe('PoolShareView: LP Manage button (MAYAChain)', () => {
  it('halt status unknown (lastblock and inbound_addresses failed): Manage stays enabled', () => {
    mocks.haltedChains$ = Rx.of(inboundDown)
    setupMaya(mayaMimir, lastblockDown)
    render(['DASH.DASH'])
    expect(manageDisabled('DASH')).toBe(false)
  })

  it('guard: a proven chain halt (HALTDASHCHAIN) disables Manage', () => {
    setupMaya({ ...mayaMimir, HALTDASHCHAIN: 1 }, mayaBlock)
    render(['DASH.DASH'])
    expect(manageDisabled('DASH')).toBe(true)
  })

  it('a proven LP pause (PAUSELPDASH) disables Manage (missed before: only chain halts were checked)', () => {
    setupMaya({ ...mayaMimir, PAUSELPDASH: 1 }, mayaBlock)
    render(['DASH.DASH'])
    expect(manageDisabled('DASH')).toBe(true)
  })
})
