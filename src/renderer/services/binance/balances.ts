import { Network } from '@xchainjs/xchain-client'
import * as FP from 'fp-ts/lib/function'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { client$ } from './common'

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
const balances$: (
  walletType: WalletType,
  network: Network,
  walletIndex: number,
  hdMode: HDMode
) => C.WalletBalancesLD = (walletType, network, walletIndex, hdMode) =>
  FP.pipe(
    C.balances$({ client$, trigger$: reloadBalances$, walletType, walletIndex, hdMode, walletBalanceType: 'all' })
  )

const getBalanceByAddress$ = C.balancesByAddress$({ client$, trigger$: reloadBalances$, walletBalanceType: 'all' })

export { balances$, reloadBalances, reloadBalances$, resetReloadBalances, getBalanceByAddress$ }
