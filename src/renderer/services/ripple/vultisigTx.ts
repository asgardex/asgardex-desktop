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
 * SDK memo convention for Ripple:
 * - Pure integer memo → SDK sets it as XRP destinationTag
 * - Non-integer memo → SDK sets it as text MemoData (e.g. THORChain swap instructions)
 * - No memo → plain payment
 *
 * When the user provides a destinationTag and no memo, we pass it as the memo string.
 * When there IS a memo (swap/deposit), the memo takes precedence — Dex inbound
 * addresses don't require destination tags.
 */
export const createVultisigXrpTx = (): ((args: { network: Network; params: SendTxParams }) => TxHashLD) => {
  return ({ params }): TxHashLD => {
    const { asset, recipient, amount, memo } = params

    const vaultId = appWalletService.getActiveVaultId()
    if (!vaultId) {
      window.apiLog.error('[Vultisig]', 'XRP tx failed: no active vault')
      return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'No active Vultisig vault' }))
    }

    // SDK memo-as-integer convention: pure integer memo = destinationTag
    // If there's a text memo (swap routing), it takes precedence over destinationTag
    const effectiveMemo = memo || (params.destinationTag !== undefined ? String(params.destinationTag) : undefined)

    const txParams: SendTransactionParams = {
      vaultId,
      chain: 'XRP',
      receiver: recipient,
      amount: amount.amount().toFixed(),
      memo: effectiveMemo,
      decimals: amount.decimal,
      ticker: asset.ticker
    }

    window.apiLog.info('[Vultisig]', 'XRP sendTransaction via SDK pipeline', {
      receiver: recipient,
      amount: amount.amount().toFixed(),
      memo: effectiveMemo || '(none)',
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
