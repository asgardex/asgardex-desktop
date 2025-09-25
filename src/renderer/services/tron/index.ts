import { network$ } from '../app/service'
import {
  balances$,
  reloadBalances,
  getBalanceByAddress$,
  reloadBalances$,
  resetReloadBalances,
  enhancedClient$
} from './balances'
import { client$, clientState$, address$, addressUI$, explorerUrl$ } from './common'
import { createFeesService } from './fees'
import { createTransactionService } from './transaction'

const { subscribeTx, txRD$, resetTx, sendTx, txs$, tx$, txStatus$, approveTRC20Token$, isApprovedTRC20Token$ } =
  createTransactionService(client$, network$)
const { fees$, reloadFees } = createFeesService(enhancedClient$)

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
  subscribeTx,
  sendTx,
  txRD$,
  resetTx,
  txs$,
  tx$,
  txStatus$,
  approveTRC20Token$,
  isApprovedTRC20Token$
}
