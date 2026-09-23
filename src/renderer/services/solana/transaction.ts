import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { SOLChain, SOLAsset } from '@xchainjs/xchain-solana'
import { either as E, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { isLedgerWallet, isVultisigWallet } from '../../../shared/utils/guard'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { TxHashLD, ErrorId } from '../wallet/types'
import { toIntegerSolPriorityFee } from './solPriorityFee'
import { Client$, SendTxParams, TransactionService } from './types'
import { createVultisigSolanaTx } from './vultisigTx'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: SOLChain,
      network,
      asset: SOLAsset,
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
                  msg: `Sending Ledger SOL tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const sendVultisigTx = createVultisigSolanaTx()

  const sendKeystoreTx = (params: SendTxParams): TxHashLD =>
    FP.pipe(
      client$,
      RxOp.take(1),
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () =>
              Rx.of(
                RD.failure({
                  errorId: ErrorId.SEND_TX,
                  msg: 'SOL client not ready'
                })
              ),
            (client) =>
              Rx.from(
                client.transfer({
                  walletIndex: params.walletIndex,
                  asset: params.asset as Parameters<typeof client.transfer>[0]['asset'],
                  amount: params.amount,
                  recipient: params.recipient,
                  memo: params.memo,
                  priorityFee: toIntegerSolPriorityFee(params.priorityFee),
                  allowOwnerOffCurve: params.allowOwnerOffCurve
                })
              ).pipe(
                RxOp.map(RD.success),
                RxOp.catchError((error) =>
                  Rx.of(
                    RD.failure({
                      errorId: ErrorId.SEND_TX,
                      msg: error?.message ?? error?.toString?.() ?? String(error)
                    })
                  )
                )
              )
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )

  const sendTx = (params: SendTxParams) =>
    FP.pipe(
      network$,
      RxOp.take(1),
      RxOp.switchMap((network) => {
        if (isLedgerWallet(params.walletType)) return sendLedgerTx({ network, params })
        if (isVultisigWallet(params.walletType)) return sendVultisigTx({ network, params })
        return sendKeystoreTx(params)
      })
    )

  return {
    ...common,
    sendTx
  }
}
