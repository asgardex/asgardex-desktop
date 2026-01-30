import { HDMode, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { createEnhancedClient$ } from '../clients'
import { client$, readOnlyClient$ } from './common'

/**
 * Enhanced client that switches between keystore and read-only client for standalone ledger mode
 */
const enhancedClient$ = createEnhancedClient$(client$, readOnlyClient$)

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

export { balances$, reloadBalances, getBalanceByAddress$, reloadBalances$, resetReloadBalances, enhancedClient$ }
