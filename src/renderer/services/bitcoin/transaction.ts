import * as RD from '@devexperts/remote-data-ts'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network, TxHash } from '@xchainjs/xchain-client'
import * as E from 'fp-ts/lib/Either'
import * as FP from 'fp-ts/lib/function'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { blockcypherApiKey } from '../../../shared/api/blockcypher'
import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { AssetBTC } from '../../../shared/utils/asset'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { SendTxParams, TransactionService } from '../utxo/types'
import { TxHashLD, ErrorId } from '../wallet/types'
import { Client$ } from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const { amount, sender, recipient, memo, walletAccount, walletIndex, feeRate, feeOption } = params
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: BTCChain,
      asset: AssetBTC,
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
      apiKey: blockcypherApiKey
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
                  msg: `Sending Ledger BTC tx failed. (${msg})`
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

        return common.sendTx(params)
      })
    )

  return {
    ...common,
    sendTx
  }
}
