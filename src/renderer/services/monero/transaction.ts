import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'

import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { TxHashLD, TxHashRD, ErrorId } from '../wallet/types'
import { Client$, SendTxParams, TransactionService } from './types'

export const XMR_SEND_DISABLED_MSG = 'Sending Monero (XMR) is not supported yet (watch-only wallet).'

/**
 * Transaction service of XMR: **history / status only**.
 *
 * `sendTx` is deliberately overridden and always fails: `@xchainjs/xchain-monero` can send via a local
 * `monero-wallet-rpc` only, which ASGARDEX does not use. The inherited `sendTx` (-> `client.transfer`) is never exposed.
 */
export const createTransactionService = (client$: Client$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendTx = (_params: SendTxParams): TxHashLD =>
    Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: XMR_SEND_DISABLED_MSG }))

  // `common.subscribeTx` would call `client.transfer` as well -> replaced, too.
  const { get$: txRD$, set: setTxRD } = observableState<TxHashRD>(RD.initial)
  const subscribeTx = (params: SendTxParams): Rx.Subscription => sendTx(params).subscribe(setTxRD)

  return {
    txs$: common.txs$,
    tx$: common.tx$,
    txStatus$: common.txStatus$,
    txRD$,
    resetTx: () => setTxRD(RD.initial),
    sendTx,
    subscribeTx
  }
}
