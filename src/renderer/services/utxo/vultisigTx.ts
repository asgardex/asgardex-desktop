/**
 * Vultisig SEND handler for UTXO chains (not pool/swap transactions)
 *
 * Uses SDK native pipeline: prepareSendTx → extractMessageHashes → sign → broadcastTx
 * The SDK handles UTXO selection, fee estimation, and broadcasting.
 *
 * For UTXO chains, swaps are plain sends to THORChain inbound address with a memo,
 * so this handler may also serve swap transactions (memo passed through as-is).
 */
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { SendTransactionParams } from '../../../shared/api/mpcTypes'
import { createScopedLogger } from '../../helpers/logger'

const logger = createScopedLogger('Vultisig')
import { XChainClient$ } from '../clients/types'
import { appWalletService } from '../wallet/appWallet'
import { ErrorId, TxHashLD } from '../wallet/types'
import { SendTxParams } from './types'

/**
 * Creates a Vultisig send handler for UTXO chains
 *
 * @param client$ - UTXO chain client (unused for send — SDK native pipeline handles everything)
 * @param chainName - Chain identifier (e.g., 'BTC', 'LTC', 'DOGE', 'DASH', 'BCH')
 */
export const createVultisigUtxoTx = (
  client$: XChainClient$,
  chainName: string
): (({ network, params }: { network: Network; params: SendTxParams }) => TxHashLD) => {
  // Suppress unused warning — client$ kept for API consistency with keystore/ledger handlers
  void client$

  return ({ params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const { asset, recipient, amount, memo } = params

    const vaultId = appWalletService.getActiveVaultId()
    if (!vaultId) {
      logger.error(`${chainName} tx failed: no active vault`)
      return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'No active Vultisig vault' }))
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
      amount: amount.amount().toString(),
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
            errorId: ErrorId.SEND_TX,
            msg: `Vultisig ${chainName} tx failed: ${errorMsg}`
          })
        )
      }),
      RxOp.startWith(RD.pending)
    )
  }
}
