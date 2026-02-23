/**
 * Vultisig SEND handler for EVM chains (not pool/swap transactions)
 *
 * Uses SDK native pipeline: prepareSendTx → extractMessageHashes → sign → broadcastTx
 * The SDK handles gas estimation, nonce, and broadcasting.
 *
 * Pool transactions (swaps, deposits via router contract) are handled separately
 * in sendPoolTx$ within each chain's transaction.ts.
 */
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { SendTransactionParams } from '../../../shared/api/mpcTypes'
import { appWalletService } from '../wallet/appWallet'
import { ErrorId, TxHashLD } from '../wallet/types'
import { Client$, SendTxParams } from './types'

/**
 * Creates a Vultisig send handler for EVM chains
 *
 * @param client$ - EVM chain client (unused for send — SDK native pipeline handles everything)
 * @param chainName - Chain identifier (e.g., 'ETH', 'BSC', 'AVAX', 'ARB', 'BASE')
 */
export const createVultisigEvmTx = (
  client$: Client$,
  chainName: string
): (({ network, params }: { network: Network; params: SendTxParams }) => TxHashLD) => {
  // Suppress unused warning — client$ kept for API consistency with keystore/ledger handlers
  void client$

  return ({ params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const { asset, recipient, amount, memo } = params

    const vaultId = appWalletService.getActiveVaultId()
    if (!vaultId) {
      window.apiLog.error('[Vultisig]', `${chainName} tx failed: no active vault`)
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

    window.apiLog.info('[Vultisig]', `${chainName} sendTransaction via SDK pipeline`, {
      receiver: recipient,
      amount: amount.amount().toString(),
      memo: memo || '(none)',
      vaultId,
      ticker: asset.ticker
    })

    return Rx.from(window.apiMpc.sendTransaction(txParams)).pipe(
      RxOp.map(({ txHash }) => {
        window.apiLog.info('[Vultisig]', `${chainName} tx success`, { txHash })
        return RD.success(txHash)
      }),
      RxOp.catchError((error) => {
        const errorMsg = error?.message ?? error.toString()

        if (errorMsg.includes('Signing cancelled')) {
          window.apiLog.info('[Vultisig]', `${chainName} tx cancelled by user`)
          return Rx.of(RD.initial)
        }

        window.apiLog.error('[Vultisig]', `${chainName} tx failed`, { error: errorMsg })
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
