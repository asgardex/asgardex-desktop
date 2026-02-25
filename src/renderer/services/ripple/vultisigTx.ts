/**
 * Vultisig SEND handler for XRP (Ripple)
 *
 * Uses SDK native pipeline: prepareSendTx → extractMessageHashes → sign → broadcastTx
 * Follows the Cosmos factory pattern (createVultisigCosmosTx).
 */
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { SendTransactionParams } from '../../../shared/api/mpcTypes'
import { appWalletService } from '../wallet/appWallet'
import { ErrorId, TxHashLD } from '../wallet/types'
import { SendTxParams } from './types'

/**
 * Creates a Vultisig send handler for XRP
 *
 * Note: XRP destination tags are not yet supported through the SDK pipeline.
 * The SDK's Ripple chain handler may support them via memo or internally.
 */
export const createVultisigXrpTx = (): ((args: { network: Network; params: SendTxParams }) => TxHashLD) => {
  return ({ params }): TxHashLD => {
    const { asset, recipient, amount, memo } = params

    const vaultId = appWalletService.getActiveVaultId()
    if (!vaultId) {
      window.apiLog.error('[Vultisig]', 'XRP tx failed: no active vault')
      return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'No active Vultisig vault' }))
    }

    const txParams: SendTransactionParams = {
      vaultId,
      chain: 'XRP',
      receiver: recipient,
      amount: amount.amount().toFixed(),
      memo,
      decimals: amount.decimal,
      ticker: asset.ticker
    }

    window.apiLog.info('[Vultisig]', 'XRP sendTransaction via SDK pipeline', {
      receiver: recipient,
      amount: amount.amount().toFixed(),
      memo: memo || '(none)',
      destinationTag: params.destinationTag,
      vaultId,
      ticker: asset.ticker
    })

    return Rx.from(window.apiMpc.sendTransaction(txParams)).pipe(
      RxOp.map(({ txHash }) => {
        window.apiLog.info('[Vultisig]', 'XRP tx success', { txHash })
        return RD.success(txHash)
      }),
      RxOp.catchError((error) => {
        const errorMsg = error?.message ?? error.toString()

        if (errorMsg.includes('Signing cancelled')) {
          window.apiLog.info('[Vultisig]', 'XRP tx cancelled by user')
          return Rx.of(RD.initial)
        }

        window.apiLog.error('[Vultisig]', 'XRP tx failed', { error: errorMsg })
        return Rx.of(
          RD.failure({
            errorId: ErrorId.SEND_TX,
            msg: `Vultisig XRP tx failed: ${errorMsg}`
          })
        )
      }),
      RxOp.startWith(RD.pending)
    )
  }
}
