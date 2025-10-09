import { XRPChain } from '@xchainjs/xchain-ripple'
import { network$ } from '../app/service'
import {
  reloadBalances,
  balances$,
  getBalanceByAddress$,
  reloadBalances$,
  resetReloadBalances,
  enhancedClient$
} from './balances'
import { client$, clientState$, address$, addressUI$, explorerUrl$ } from './common'
import { createFeesService } from './fees'
import { createTransactionService } from './transaction'

const { txs$, tx$, txStatus$, subscribeTx, resetTx, sendTx, txRD$ } = createTransactionService(client$, network$)
const { reloadFees, fees$ } = createFeesService({ client$: enhancedClient$, chain: XRPChain })

export {
  client$,
  clientState$,
  address$,
  addressUI$,
  explorerUrl$,
  reloadBalances,
  balances$,
  getBalanceByAddress$,
  reloadBalances$,
  resetReloadBalances,
  enhancedClient$,
  txs$,
  tx$,
  txStatus$,
  reloadFees,
  fees$,
  subscribeTx,
  resetTx,
  sendTx,
  txRD$
}
