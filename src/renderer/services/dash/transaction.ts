import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { Client, AssetDASH, DASHChain } from '@xchainjs/xchain-dash'
import * as E from 'fp-ts/lib/Either'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { TxHashLD, ErrorId } from '../wallet/types'
import { TransactionService } from './types'
import { Client$, SendTxParams } from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendKeystoreTx = (params: SendTxParams): TxHashLD => {
    const { recipient, amount, memo } = params

    return FP.pipe(
      client$, // Client observable
      RxOp.tap((clientOption) => {
        // Log whether client$ is valid or not
        if (O.isNone(clientOption)) {
          console.error('Client is None or empty')
        } else {
          console.log('Client is available')
        }
      }),
      RxOp.switchMap(
        FP.flow(
          O.fold<Client, Rx.Observable<Client>>(
            () => {
              console.error('Client is None or empty, returning EMPTY')
              return Rx.EMPTY
            },
            (client) => {
              console.log('Resolved client:', client)
              return Rx.of(client)
            }
          )
        )
      ),
      RxOp.switchMap((client) => {
        // More logging before transfer to ensure everything is correct
        console.log('Attempting transfer with client:', client)
        console.log('Transfer details - recipient:', recipient)
        console.log('Transfer details - amount:', amount.amount().toNumber())
        console.log('Transfer details - memo:', memo)
        console.log('Transfer details - asset:', AssetDASH)
        console.log('Transfer details - feeRate:', 1)

        // Call the transfer method
        return Rx.from(
          client.transfer({
            asset: AssetDASH,
            recipient,
            amount,
            memo,
            feeRate: 1
          })
        )
      }),
      RxOp.map((txHash) => {
        console.log('Transaction successful, hash:', txHash)
        return RD.success(txHash)
      }),
      RxOp.catchError((e): TxHashLD => {
        console.error('Error during transaction:', e)
        return Rx.of(
          RD.failure({
            msg: e?.message ?? e.toString(),
            errorId: ErrorId.SEND_TX
          })
        )
      }),
      RxOp.startWith(RD.pending)
    )
  }

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const { amount, sender, recipient, memo, walletIndex, feeRate, walletAccount } = params
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: DASHChain,
      asset: AssetDASH,
      feeAsset: undefined,
      network,
      amount,
      sender,
      feeRate,
      feeOption: undefined,
      feeAmount: undefined,
      recipient,
      memo,
      walletAccount,
      walletIndex,
      nodeUrl: undefined,
      hdMode: 'default'
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
                  msg: `Sending Ledger Dash tx failed. (${msg})`
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

        return sendKeystoreTx(params)
      })
    )

  return {
    ...common,
    sendTx
  }
}
