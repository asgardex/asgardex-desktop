import { option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { network$ } from '../app/service'
import { balances$, getBalanceByAddress$, reloadBalances, reloadBalances$, resetReloadBalances } from './balances'
import { client$, clientState$, address$, addressUI$, explorerUrl$, readOnlyClient$ } from './common'
import { createFeesService } from './fees'
import { createTransactionService } from './transaction'

// Combined client that uses regular client if available, otherwise falls back to read-only client
const combinedClient$ = Rx.combineLatest([client$, readOnlyClient$]).pipe(
  RxOp.map(([client, readOnlyClient]) => O.alt(() => readOnlyClient)(client)),
  RxOp.shareReplay(1)
)

const { fees$, feesWithRates$, reloadFees, reloadFeesWithRates } = createFeesService(combinedClient$)
const { txs$, tx$, txStatus$, subscribeTx, resetTx, sendTx, txRD$ } = createTransactionService(client$, network$)

export {
  client$,
  clientState$,
  explorerUrl$,
  address$,
  addressUI$,
  reloadBalances,
  reloadBalances$,
  resetReloadBalances,
  balances$,
  getBalanceByAddress$,
  fees$,
  reloadFeesWithRates,
  feesWithRates$,
  reloadFees,
  txs$,
  tx$,
  txStatus$,
  subscribeTx,
  resetTx,
  sendTx,
  txRD$
}
