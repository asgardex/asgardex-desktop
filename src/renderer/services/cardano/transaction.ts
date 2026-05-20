import * as RD from '@devexperts/remote-data-ts'
import { ADAChain, ADAAsset, Client } from '@xchainjs/xchain-cardano'
import { Network, TxHash } from '@xchainjs/xchain-client'
import * as E from 'fp-ts/lib/Either'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { isLedgerWallet, isVultisigWallet } from '../../../shared/utils/guard'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { TxHashLD, ErrorId } from '../wallet/types'
import { TransactionService, Client$, SendTxParams } from './types'
import { createVultisigCardanoTx } from './vultisigTx'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: ADAChain,
      network,
      asset: ADAAsset,
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
                  msg: `Sending Ledger ADA tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  // Vultisig transaction handler — SDK native pipeline
  const sendVultisigTx = createVultisigCardanoTx()

  const sendKeystoreMaxTx = (params: SendTxParams): TxHashLD =>
    FP.pipe(
      client$,
      RxOp.switchMap(FP.flow(O.fold<Client, Rx.Observable<Client>>(() => Rx.EMPTY, Rx.of))),
      RxOp.switchMap((client) =>
        Rx.from(
          client.transferMax({
            recipient: params.recipient,
            memo: params.memo,
            walletIndex: params.walletIndex
          })
        )
      ),
      RxOp.map((result: { hash: TxHash }) => RD.success(result.hash)),
      RxOp.catchError((e): TxHashLD => {
        const msg = e?.message ?? e.toString()
        return Rx.of(RD.failure({ msg, errorId: ErrorId.SEND_TX }))
      }),
      RxOp.startWith(RD.pending)
    )

  const sendTx = (params: SendTxParams) =>
    FP.pipe(
      Rx.combineLatest([network$]),
      RxOp.switchMap(([network]) => {
        if (isLedgerWallet(params.walletType)) return sendLedgerTx({ network, params })
        if (isVultisigWallet(params.walletType)) return sendVultisigTx({ network, params })

        if (params.sendMax) return sendKeystoreMaxTx(params)

        return common.sendTx(params)
      })
    )

  return {
    ...common,
    sendTx
  }
}
