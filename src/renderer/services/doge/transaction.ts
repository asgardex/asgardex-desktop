import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { DOGEChain } from '@xchainjs/xchain-doge'
import * as E from 'fp-ts/lib/Either'
import * as FP from 'fp-ts/lib/function'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { AssetDOGE } from '../../../shared/utils/asset'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { TxHashLD, ErrorId } from '../wallet/types'
import { TransactionService } from './types'
import { Client$, SendTxParams } from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const { amount, sender, recipient, memo, walletIndex, feeRate, walletAccount } = params
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: DOGEChain,
      asset: AssetDOGE,
      feeAsset: undefined,
      network,
      amount,
      sender,
      feeRate,
      feeOption: undefined,
      feeAmount: undefined,
      recipient,
      memo,
      walletIndex,
      walletAccount,
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
                  msg: `Sending Ledger DOGE tx failed. (${msg})`
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
