import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { NEARChain, NEARAsset } from '@xchainjs/xchain-near'
import { either as E, function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { isLedgerWallet, isVultisigWallet } from '../../../shared/utils/guard'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { TxHashLD, ErrorId } from '../wallet/types'
import { Client$, SendTxParams, TransactionService } from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: NEARChain,
      network,
      asset: NEARAsset,
      feeAsset: undefined,
      amount: params.amount,
      sender: params.sender,
      recipient: params.recipient,
      memo: params.memo,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      feeRate: NaN,
      feeOption: undefined,
      feeAmount: undefined,
      nodeUrl: undefined,
      hdMode: params.hdMode,
      apiKey: undefined,
      destinationTag: undefined,
      evmRpcUrl: undefined,
      gasMultiplier: undefined,
      sendMax: undefined
    }
    const encoded = ipcLedgerSendTxParamsIO.encode(sendLedgerTxParams)

    return FP.pipe(
      Rx.from(window.apiHDWallet.sendLedgerTx(encoded)),
      RxOp.switchMap(
        FP.flow(
          E.fold<LedgerError, TxHash, TxHashLD>(
            ({ msg }) =>
              Rx.of(
                RD.failure({
                  errorId: ErrorId.SEND_LEDGER_TX,
                  msg: `Sending Ledger NEAR tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.catchError((error) =>
        Rx.of(
          RD.failure({
            errorId: ErrorId.SEND_LEDGER_TX,
            msg: `Sending Ledger NEAR tx failed. (${error?.message ?? String(error)})`
          })
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  // Vultisig transaction handler - placeholder for NEAR
  const sendVultisigTx = (_params: { network: Network; params: SendTxParams }): TxHashLD =>
    Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'Vultisig not supported for NEAR' }))

  const sendTx = (params: SendTxParams) =>
    FP.pipe(
      network$,
      RxOp.take(1),
      RxOp.switchMap((network) => {
        if (isLedgerWallet(params.walletType)) return sendLedgerTx({ network, params })
        if (isVultisigWallet(params.walletType)) return sendVultisigTx({ network, params })
        return common.sendTx(params)
      })
    )

  return {
    ...common,
    sendTx
  }
}
