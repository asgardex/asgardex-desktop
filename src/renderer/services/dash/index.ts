import { network$ } from '../app/service'
import { balances$, reloadBalances, getBalanceByAddress$, reloadBalances$, resetReloadBalances } from './balance'
import { client$, clientState$, address$, addressUI$, explorerUrl$ } from './common'
import { createFeesService } from './fees'
import { createTransactionService } from './transaction'

const { subscribeTx, txRD$, resetTx, sendTx, txs$, tx$, txStatus$ } = createTransactionService(client$, network$)
const { fees$, reloadFees, feesWithRates$, reloadFeesWithRates } = createFeesService(client$)

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
