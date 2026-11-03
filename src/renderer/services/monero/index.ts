import { balances$, reloadBalances, reloadBalances$, resetReloadBalances, enhancedClient$ } from './balances'
import { client$, clientState$, address$, addressUI$, explorerUrl$ } from './common'
import { createFeesService } from './fees'
import { createTransactionService } from './transaction'

const { subscribeTx, txRD$, resetTx, sendTx, txs$, tx$, txStatus$ } = createTransactionService(client$)
const { reloadFees, fees$ } = createFeesService(enhancedClient$)

export {
  address$,
  addressUI$,
  explorerUrl$,
  client$,
  clientState$,
  balances$,
  reloadBalances,
  reloadBalances$,
  resetReloadBalances,
  subscribeTx,
  txRD$,
  resetTx,
  sendTx,
  txs$,
  tx$,
  txStatus$,
  fees$,
  reloadFees
}
