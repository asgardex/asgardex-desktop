/**
 * Generic Vultisig SEND handler using SDK native pipeline
 *
 * Used by chains that don't fit UTXO or Cosmos patterns (TRON, ADA, XRD, etc.)
 * Uses SDK native pipeline: prepareSendTx → extractMessageHashes → sign → broadcastTx
 */
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { SendTransactionParams } from '../../../shared/api/mpcTypes'
import { createScopedLogger } from '../../helpers/logger'
import { appWalletService } from '../wallet/appWallet'
import { ErrorId, TxHashLD } from '../wallet/types'

const logger = createScopedLogger('Vultisig')

/** Minimal params shape shared across chain-specific SendTxParams */
type GenericSendParams = {
  recipient: string
  amount: BaseAmount
  asset: AnyAsset
  memo?: string
}

/**
 * Creates a Vultisig send handler for any chain using the SDK native pipeline.
 *
 * @param chainName - Chain identifier (e.g., 'TRON', 'ADA', 'XRD')
 * @param errorId - Error ID to use on failure (default: ErrorId.SEND_TX)
 */
export const createVultisigSdkNativeTx = (
  chainName: string,
  errorId: ErrorId = ErrorId.SEND_TX
): ((args: { network: Network; params: GenericSendParams }) => TxHashLD) => {
  return ({ params }): TxHashLD => {
    const { asset, recipient, amount, memo } = params

    const vaultId = appWalletService.getActiveVaultId()
    if (!vaultId) {
      logger.error(`${chainName} tx failed: no active vault`)
      return Rx.of(RD.failure({ errorId, msg: 'No active Vultisig vault' }))
    }

    const txParams: SendTransactionParams = {
      vaultId,
      chain: chainName,
      receiver: recipient,
      amount: amount.amount().toFixed(),
      memo,
      decimals: amount.decimal,
      ticker: asset.ticker
    }

    logger.info(`${chainName} sendTransaction via SDK pipeline`, {
      receiver: recipient,
      amount: amount.amount().toFixed(),
      memo: memo || '(none)',
      vaultId,
      ticker: asset.ticker
    })

    return Rx.from(window.apiMpc.sendTransaction(txParams)).pipe(
      RxOp.map(({ txHash }) => {
        logger.info(`${chainName} tx success`, { txHash })
        return RD.success(txHash)
      }),
      RxOp.catchError((error) => {
        const errorMsg = error?.message ?? error.toString()

        if (errorMsg.includes('Signing cancelled')) {
          logger.info(`${chainName} tx cancelled by user`)
          return Rx.of(RD.initial)
        }

        logger.error(`${chainName} tx failed`, { error: errorMsg })
        return Rx.of(
          RD.failure({
            errorId,
            msg: `Vultisig ${chainName} tx failed: ${errorMsg}`
          })
        )
      }),
      RxOp.startWith(RD.pending)
    )
  }
}
