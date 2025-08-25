import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { appWalletService } from '../wallet/appWallet'
import { isStandaloneLedgerMode } from '../wallet/types'
import { client$, readOnlyClient$ } from './common'

/**
 * Enhanced client that switches between keystore and read-only client for standalone ledger mode
 */
const enhancedClient$ = FP.pipe(
  Rx.combineLatest([client$, readOnlyClient$, appWalletService.appWalletState$]),
  RxOp.map(([keystoreClient, readOnlyClient, appWalletState]) => {
    // If keystore client is available, use it
    if (O.isSome(keystoreClient)) {
      return keystoreClient
    }

    // If keystore is locked but we're in standalone ledger mode, use read-only client
    if (appWalletState && isStandaloneLedgerMode(appWalletState) && O.isSome(readOnlyClient)) {
      return readOnlyClient
    }

    // Otherwise, no client available
    return O.none
  }),
  RxOp.distinctUntilChanged(),
  RxOp.shareReplay({ bufferSize: 1, refCount: true })
)

/**
 * `ObservableState` to reload `Balances`
 * Sometimes we need to have a way to understand if it simple "load" or "reload" action
 * e.g. @see src/renderer/services/wallet/balances.ts:getChainBalance$
 */
const { get$: reloadBalances$, set: setReloadBalances } = observableState<boolean>(false)
const { get$: reloadLedgerBalances$, set: setReloadLedgerBalances } = observableState<boolean>(false)

const resetReloadBalances = (walletType: WalletType) => {
  if (walletType === WalletType.Keystore) {
    setReloadBalances(false)
  } else {
    setReloadLedgerBalances(false)
  }
}

const reloadBalances = (walletType: WalletType) => {
  if (walletType === WalletType.Keystore) {
    setReloadBalances(true)
  } else {
    setReloadLedgerBalances(true)
  }
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
  trigger$: reloadLedgerBalances$,
  walletBalanceType: 'all'
})

export { balances$, reloadBalances, getBalanceByAddress$, reloadBalances$, resetReloadBalances }
