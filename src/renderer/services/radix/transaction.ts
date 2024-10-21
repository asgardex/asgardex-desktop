import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import {
  RadixChain,
  AssetXRD,
  Client as XrdClient,
  generateAddressParam,
  generateBucketParam,
  generateStringParam,
  CompatibleAsset
} from '@xchainjs/xchain-radix'
import * as E from 'fp-ts/lib/Either'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import {
  IPCLedgerDepositTxParams,
  IPCLedgerSendTxParams,
  ipcLedgerDepositTxParamsIO,
  ipcLedgerSendTxParamsIO
} from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { sequenceSOption } from '../../helpers/fpHelpers'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { TxHashLD, ErrorId, ApiError } from '../wallet/types'
import { SendPoolTxParams, TransactionService } from './types'
import { Client$, SendTxParams } from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)
  const runSendPoolTx$ = (client: XrdClient, { ...params }: SendPoolTxParams): TxHashLD => {
    // Helper for failures
    const failure$ = (msg: string) =>
      Rx.of<RD.RemoteData<ApiError, never>>(
        RD.failure({
          errorId: ErrorId.POOL_TX,
          msg
        })
      )

    return FP.pipe(
      sequenceSOption({ router: params.router }),
      O.fold(
        () => failure$(`Invalid values: Asset ${params.asset} / router address ${params.router}`),
        ({ router }) =>
          Rx.of(null).pipe(
            // Start the pipeline with sender address
            RxOp.switchMap(() => Rx.from(client.getAddressAsync(params.walletIndex))),
            RxOp.switchMap((senderAddress) =>
              Rx.from(
                client.transfer({
                  asset: params.asset as CompatibleAsset,
                  recipient: router,
                  amount: params.amount,
                  methodToCall: {
                    address: router,
                    methodName: 'user_deposit',
                    params: [
                      generateAddressParam(senderAddress),
                      generateAddressParam(params.recipient),
                      generateBucketParam(0),
                      generateStringParam(params.memo)
                    ]
                  }
                })
              )
            ),
            RxOp.map((txResult) => RD.success(txResult)),
            RxOp.catchError((error): TxHashLD => failure$(error?.message ?? error.toString())),
            RxOp.startWith(RD.pending)
          )
      )
    )
  }

  const sendLedgerPoolTx = ({ network, params }: { network: Network; params: SendPoolTxParams }): TxHashLD => {
    const ipcParams: IPCLedgerDepositTxParams = {
      chain: RadixChain,
      network,
      asset: params.asset,
      router: O.toUndefined(params.router),
      amount: params.amount,
      memo: params.memo,
      recipient: params.recipient,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      feeOption: undefined,
      nodeUrl: undefined,
      hdMode: params.hdMode,
      apiKey: undefined
    }
    const encoded = ipcLedgerDepositTxParamsIO.encode(ipcParams)

    return FP.pipe(
      Rx.from(window.apiHDWallet.depositLedgerTx(encoded)),
      RxOp.switchMap(
        FP.flow(
          E.fold<LedgerError, TxHash, TxHashLD>(
            ({ msg }) =>
              Rx.of(
                RD.failure({
                  errorId: ErrorId.DEPOSIT_LEDGER_TX_ERROR,
                  msg: `Deposit Ledger XRD tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const sendPoolTx$ = (params: SendPoolTxParams): TxHashLD => {
    if (isLedgerWallet(params.walletType))
      return FP.pipe(
        network$,
        RxOp.switchMap((network) => sendLedgerPoolTx({ network, params }))
      )

    return FP.pipe(
      client$,
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runSendPoolTx$(client, params)
          )
        )
      )
    )
  }

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: RadixChain,
      network,
      asset: AssetXRD,
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
                  msg: `Sending Ledger Xrd tx failed. (${msg})`
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

        return common.sendTx(params)
      })
    )

  return {
    ...common,
    sendTx,
    sendPoolTx$
  }
}
