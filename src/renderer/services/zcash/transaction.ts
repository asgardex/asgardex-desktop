import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { ZECChain, AssetZEC, Client } from '@xchainjs/xchain-zcash'
import { either as E, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { blockcypherApiKey } from '../../../shared/api/blockcypher'
import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { isLedgerWallet, isVultisigWallet } from '../../../shared/utils/guard'
import { getUtxoErrorMessage } from '../../helpers/utxoErrorHelper'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { SendTxParams, TransactionService } from '../utxo/types'
import { createVultisigUtxoTx } from '../utxo/vultisigTx'
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
            walletIndex: params.walletIndex,
            selectedUtxos: params.selectedUtxos
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
    const { amount, sender, recipient, memo, walletAccount, walletIndex, feeRate, feeOption } = params
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: ZECChain,
      asset: AssetZEC,
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
      hdMode: 'default',
      apiKey: blockcypherApiKey,
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
                  msg: `Sending Ledger ZEC tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  // Vultisig transaction handler - MPC signing for ZEC via SDK native pipeline
  const sendVultisigTx = createVultisigUtxoTx(client$, 'ZEC')

  const sendTx = (params: SendTxParams): TxHashLD =>
    FP.pipe(
      network$,
      RxOp.switchMap((network) => {
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
