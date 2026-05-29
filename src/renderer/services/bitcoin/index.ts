import { option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { network$ } from '../app/service'
import { balances$, reloadBalances, getBalanceByAddress$, reloadBalances$, resetReloadBalances } from './balances'
import {
  client$,
  clientState$,
  clientTR$,
  address$,
  addressUI$,
  addressTR$,
  addressUITR$,
  explorerUrl$,
  readOnlyClient$
} from './common'
import { createFeesService } from './fees'
import { createTransactionService } from './transaction'

// Combined client that uses regular client if available, otherwise falls back to read-only client
const combinedClient$ = Rx.combineLatest([client$, readOnlyClient$]).pipe(
  RxOp.map(([client, readOnlyClient]) => O.alt(() => readOnlyClient)(client)),
  RxOp.shareReplay(1)
)

// Combined Taproot client — keystore-only, falls back to read-only client for generic
// data-provider calls (history, fee rates). Tx signing still requires the keystore client.
const combinedClientTR$ = Rx.combineLatest([clientTR$, readOnlyClient$]).pipe(
  RxOp.map(([client, readOnlyClient]) => O.alt(() => readOnlyClient)(client)),
  RxOp.shareReplay(1)
)

const { subscribeTx, txRD$, resetTx, sendTx, txs$, tx$, txStatus$ } = createTransactionService(
  combinedClient$,
  combinedClientTR$,
  network$
)
const { fees$, reloadFees, feesWithRates$, reloadFeesWithRates } = createFeesService(combinedClient$)

export {
  combinedClient$,
  combinedClientTR$,
  client$,
  clientState$,
  clientTR$,
  explorerUrl$,
  address$,
  addressUI$,
  addressTR$,
  addressUITR$,
  reloadBalances,
  reloadBalances$,
  resetReloadBalances,
  balances$,
  getBalanceByAddress$,
  reloadFees,
  fees$,
  reloadFeesWithRates,
  feesWithRates$,
  subscribeTx,
  sendTx,
  txRD$,
  resetTx,
  txs$,
  tx$,
  txStatus$
}
