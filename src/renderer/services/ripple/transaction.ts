import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { AssetXRP, XRPChain } from '@xchainjs/xchain-ripple'
import { either as E, function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { TxHashLD, ErrorId } from '../wallet/types'
import { Client$, SendTxParams, TransactionService } from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: XRPChain,
      network,
      asset: AssetXRP,
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
      hdMode: 'default',
      apiKey: undefined,
      destinationTag: params.destinationTag
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
                  msg: `Sending Ledger XRP tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const sendTx = (params: SendTxParams): TxHashLD =>
    FP.pipe(
      network$,
      RxOp.switchMap((network) => {
        if (isLedgerWallet(params.walletType)) return sendLedgerTx({ network, params })

        // Map our XRP-specific params to the standard TxParams for the common service
        const txParams = {
          recipient: params.recipient,
          amount: params.amount,
          memo: params.memo,
          destinationTag: params.destinationTag
        }
        return common.sendTx(txParams)
      })
    )

  return {
    ...common,
    sendTx
  }
}
