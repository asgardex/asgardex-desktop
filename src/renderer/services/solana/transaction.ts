import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { SOLChain, SOLAsset, Client, CompatibleAsset } from '@xchainjs/xchain-solana'
import * as E from 'fp-ts/lib/Either'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { DEFAULT_FEE_OPTION } from '../../components/wallet/txs/send/Send.const'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { TxHashLD, ErrorId } from '../wallet/types'
import { Client$, SendTxParams, TransactionService } from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendKeystoreTx = (params: SendTxParams): TxHashLD => {
    const { asset, recipient, amount, memo, walletIndex } = params

    return FP.pipe(
      client$, // Start with client$
      RxOp.switchMap(FP.flow(O.fold<Client, Rx.Observable<Client>>(() => Rx.EMPTY, Rx.of))), // Ensure client exists
      RxOp.switchMap((client) =>
        FP.pipe(
          Rx.from(client.getFees({ asset: asset as CompatibleAsset, amount, recipient, memo })),
          RxOp.switchMap((fees) => {
            return Rx.from(
              client.transfer({
                walletIndex,
                asset: asset as CompatibleAsset,
                amount,
                recipient,
                memo,
                priorityFee: fees[DEFAULT_FEE_OPTION]
              })
            )
          })
        )
      ),
      RxOp.map(RD.success), // On success, return TxHash
      RxOp.catchError(
        (e): TxHashLD =>
          Rx.of(
            RD.failure({
              msg: e?.message ?? e.toString(),
              errorId: ErrorId.SEND_TX
            })
          )
      ),
      RxOp.startWith(RD.pending) // Start with a pending state
    )
  }

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
      apiKey: undefined
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

  const sendTx = (params: SendTxParams) =>
    FP.pipe(
      Rx.combineLatest([network$]),
      RxOp.switchMap(([network]) => {
        if (isLedgerWallet(params.walletType)) return sendLedgerTx({ network, params })
        return sendKeystoreTx(params)
      })
    )

  return {
    ...common,
    sendTx
  }
}
