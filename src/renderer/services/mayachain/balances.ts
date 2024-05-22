import * as RD from '@devexperts/remote-data-ts'
import { baseAmount } from '@xchainjs/xchain-util'
import { map } from 'rxjs/operators'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { WalletBalance } from '../wallet/types'
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
const balances$ = ({
  walletType,
  walletIndex,
  hdMode
}: {
  walletType: WalletType
  walletIndex: number
  hdMode: HDMode
}): C.WalletBalancesLD =>
  C.balances$({
    client$,
    trigger$: reloadBalances$,
    walletType,
    walletIndex,
    hdMode,
    walletBalanceType: 'all'
  }).pipe(
    map((remoteData) => {
      const transformedData = RD.map((balances: WalletBalance[]) =>
        balances.map((balance: WalletBalance) => {
          //temporary fix till xchainjs does it properly
          const transformedAmount = balance.asset.synth ? baseAmount(balance.amount.amount(), 8) : balance.amount
          return {
            ...balance,
            amount: transformedAmount
          }
        })
      )(remoteData)
      return transformedData
    })
  )

// State of balances loaded by Client and Address
const getBalanceByAddress$ = C.balancesByAddress$({ client$, trigger$: reloadBalances$, walletBalanceType: 'all' })

export { balances$, getBalanceByAddress$, reloadBalances, reloadBalances$, resetReloadBalances }
