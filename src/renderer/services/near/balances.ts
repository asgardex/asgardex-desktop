import { NEARChain } from '@xchainjs/xchain-near'
import { function as FP } from 'fp-ts'
import { switchMap } from 'rxjs/operators'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { createEnhancedClient$ } from '../clients'
import { getUserAssetsByChain$ } from '../storage/userChainTokens'
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

// State of balances loaded by Client — include user-selected NEP-141s
// (Settings → Import Tokens) so xchain-near 0.3.0 can query ft_balance_of.
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
  FP.pipe(
    getUserAssetsByChain$(NEARChain),
    switchMap((assets) =>
      C.balances$({
        client$: enhancedClient$,
        trigger$: reloadBalances$,
        assets: assets.length === 0 ? undefined : assets,
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        walletBalanceType: 'all'
      })
    )
  )

// State of balances loaded by Client and Address (Ledger / standalone).
// balancesByAddress$ already merges getUserAssetsByChain$ internally.
const getBalanceByAddress$ = C.balancesByAddress$({
  client$: enhancedClient$,
  trigger$: reloadBalances$,
  walletBalanceType: 'all'
})

export { balances$, reloadBalances, getBalanceByAddress$, reloadBalances$, resetReloadBalances, enhancedClient$ }
