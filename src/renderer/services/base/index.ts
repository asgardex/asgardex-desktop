import { network$ } from '../app/service'
import {
  reloadBalances,
  balances$,
  reloadBalances$,
  resetReloadBalances,
  getBalanceByAddress$,
  enhancedClient$
} from './balances'
import { client$, clientState$, address$, addressUI$, explorerUrl$ } from './common'
import { createFeesService } from './fees'
import { createTransactionService } from './transaction'

const {
  txs$,
  tx$,
  txStatus$,
  subscribeTx,
  resetTx,
  sendTx,
  txRD$,
  sendPoolTx$,
  approveERC20Token$,
  isApprovedERC20Token$
} = createTransactionService(client$, network$)
const { reloadFees, fees$, poolInTxFees$, approveFee$, reloadApproveFee } = createFeesService(enhancedClient$)

export {
  client$,
  clientState$,
  address$,
  addressUI$,
  reloadBalances,
  explorerUrl$,
  balances$,
  getBalanceByAddress$,
  reloadBalances$,
  resetReloadBalances,
  txs$,
  tx$,
  txStatus$,
  sendTx,
  subscribeTx,
  resetTx,
  txRD$,
  reloadFees,
  fees$,
  sendPoolTx$,
  poolInTxFees$,
  approveFee$,
  reloadApproveFee,
  approveERC20Token$,
  isApprovedERC20Token$
}
