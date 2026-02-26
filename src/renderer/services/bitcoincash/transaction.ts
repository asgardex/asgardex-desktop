import * as RD from '@devexperts/remote-data-ts'
import { BCHChain, Client } from '@xchainjs/xchain-bitcoincash'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { either as E, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { AssetBCH } from '../../../shared/utils/asset'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { getUtxoErrorMessage } from '../../helpers/utxoErrorHelper'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { SendTxParams, TransactionService } from '../utxo/types'
import { TxHashLD, ErrorId } from '../wallet/types'
import { Client$ } from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendKeystoreMaxTx = (params: SendTxParams): TxHashLD =>
    FP.pipe(
      client$,
      RxOp.switchMap(FP.flow(O.fold<Client, Rx.Observable<Client>>(() => Rx.EMPTY, Rx.of))),
      RxOp.switchMap((client) =>
        Rx.from(
          client.transferMax({
            recipient: params.recipient,
            memo: params.memo,
            feeRate: params.feeRate,
            selectedUtxos: params.selectedUtxos,
            utxoSelectionPreferences: params.utxoSelectionPreferences
          })
        )
      ),
      RxOp.map((result: { hash: string }) => RD.success(result.hash)),
      RxOp.catchError((e): TxHashLD => {
        const msg = getUtxoErrorMessage(e) ?? e?.message ?? e.toString()
        return Rx.of(RD.failure({ msg, errorId: ErrorId.SEND_TX }))
      }),
      RxOp.startWith(RD.pending)
    )

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const {
      amount,
      sender,
      recipient,
      memo,
      walletAccount,
      walletIndex,
      feeRate,
      feeOption,
      hdMode,
      sendMax,
      selectedUtxos,
      utxoSelectionPreferences
    } = params
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: BCHChain,
      asset: AssetBCH,
      feeAsset: undefined,
      network,
      amount,
      sender,
      feeRate,
      feeOption,
      feeAmount: undefined,
      recipient,
      memo,
      walletAccount,
      walletIndex,
      nodeUrl: undefined,
      hdMode,
      apiKey: undefined,
      destinationTag: undefined,
      evmRpcUrl: undefined,
      gasMultiplier: undefined,
      sendMax,
      selectedUtxos: selectedUtxos?.map(({ hash, index, value }) => ({ hash, index, value })),
      utxoSelectionPreferences
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
                  msg: `Sending Ledger BCH tx failed. (${msg})`
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

        if (params.sendMax) return sendKeystoreMaxTx(params)

        return common.sendTx(params)
      })
    )

  return {
    ...common,
    sendTx
  }
}
