/**
 * While trade-account balances refresh, the table renders a placeholder column. react-table needs an id for
 * every column (`constructColumn` throws on an empty one), and there is no error boundary, so a column
 * without `id` / `accessorKey` and an empty header blanked the Trade Assets view on refresh.
 */
import { act, createElement } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { assetFromStringEx, baseAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { createRoot, Root } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { MemoryRouter } from 'react-router-dom'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { WalletType } from '../../../../shared/wallet/types'
import en from '../../../i18n/en'
import { TradeAccount } from '../../../services/thorchain/types'
import { Protocol } from '../../uielements/protocolSwitch/types'
import { TradeAssetsTableCollapsable } from './TradeAssetsTableCollapsable'

vi.mock('../../../contexts/ChainContext', () => ({
  useChainContext: () => ({ tradeWithdraw$: () => Rx.EMPTY, clientByChain$: () => Rx.EMPTY })
}))
vi.mock('../../../contexts/WalletContext', () => ({
  useWalletContext: () => ({ keystoreService: { validatePassword$: () => Rx.EMPTY } })
}))
vi.mock('../../../store/app/hooks', () => ({ useApp: () => ({ setProtocol: () => {} }) }))

const account: TradeAccount = {
  asset: assetFromStringEx('BTC~BTC'),
  units: baseAmount(100_000),
  owner: 'thor1owner',
  lastAddHeight: O.none,
  lastWithdrawHeight: O.none,
  walletType: WalletType.Keystore,
  protocol: Protocol.THORChain
}

let root: Root
let container: HTMLDivElement

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

const render = (isRefreshing: boolean) =>
  act(() =>
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          IntlProvider,
          { locale: 'en', messages: en },
          createElement(TradeAssetsTableCollapsable, {
            chainBalances: Rx.of([]),
            disableRefresh: false,
            tradeAccountBalances: [account],
            pricePool: { asset: assetFromStringEx('THOR.RUNE'), poolData: undefined } as never,
            pricePoolMaya: { asset: assetFromStringEx('MAYA.CACAO'), poolData: undefined } as never,
            poolsData: {},
            poolsDataMaya: {},
            poolDetails: [],
            poolDetailsMaya: [],
            pendingPoolDetails: [],
            pendingPoolDetailsMaya: [],
            selectAssetHandler: () => {},
            mimirHalt: { _tag: 'RemoteInitial' } as never,
            network: Network.Mainnet,
            hidePrivateData: false,
            refreshHandler: () => {},
            isRefreshing
          })
        )
      )
    )
  )

it('renders the loading table while trade-account balances refresh (no throw)', () => {
  expect(() => render(true)).not.toThrow()
  expect(container.textContent).toContain(en['common.loading'])
})
