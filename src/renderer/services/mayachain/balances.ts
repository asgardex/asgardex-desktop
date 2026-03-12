import * as RD from '@devexperts/remote-data-ts'
import * as RxOp from 'rxjs/operators'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { createEnhancedClient$ } from '../clients/enhancedClient'
import { client$, readOnlyClient$ } from './common'

/**
 * `ObservableState` to reload `Balances`
 * Sometimes we need to have a way to understand if it simple "load" or "reload" action
 * e.g. @see src/renderer/services/wallet/balances.ts:getChainBalance$
 */
const { get$: reloadBalances$, set: setReloadBalances } = observableState<boolean>(false)

const resetReloadBalances = () => {
  setReloadBalances(false)
}

const reloadBalances = () => {
  setReloadBalances(true)
}

/**
 * Enhanced client that falls back to read-only client for standalone modes (Ledger, Vultisig)
 */
const enhancedClient$ = createEnhancedClient$(client$, readOnlyClient$.pipe(RxOp.map(RD.toOption)))

// State of balances loaded by Client
const balances$ = ({
  walletType,
  walletAccount,
  walletIndex,
  hdMode
}: {
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}): C.WalletBalancesLD =>
  C.balances$({
    client$: enhancedClient$,
    trigger$: reloadBalances$,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletBalanceType: 'all'
  })

// State of balances loaded by Client and Address
const getBalanceByAddress$ = C.balancesByAddress$({
  client$: enhancedClient$,
  trigger$: reloadBalances$,
  walletBalanceType: 'all'
})

export { balances$, getBalanceByAddress$, reloadBalances, reloadBalances$, resetReloadBalances, enhancedClient$ }
