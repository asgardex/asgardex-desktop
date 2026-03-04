/**
 * Shared Vultisig SEND handler for Cosmos chains (THOR, MAYA, GAIA)
 *
 * Uses SDK native pipeline: prepareSendTx → extractMessageHashes → sign → broadcastTx
 * The SDK handles fee estimation, signing, and broadcasting.
 */
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { SendTransactionParams } from '../../../shared/api/mpcTypes'
import { createScopedLogger } from '../../helpers/logger'

const logger = createScopedLogger('Vultisig')
import { appWalletService } from '../wallet/appWallet'
import { ErrorId, TxHashLD } from '../wallet/types'

/** Minimal params shape shared by THOR, MAYA, and GAIA SendTxParams */
type CosmosSendParams = {
  recipient?: string
  amount: BaseAmount
  asset: AnyAsset
  memo?: string
}

/** getDenom signature — each xchainjs chain package exports getDenom with slightly different asset types */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GetDenomFn = (asset: any) => string | null

/**
 * Creates a Vultisig send handler for Cosmos-SDK chains
 *
 * @param chainName - Chain identifier ('THOR', 'MAYA', 'GAIA')
 * @param getDenom - xchainjs getDenom for this chain (e.g. from @xchainjs/xchain-thorchain)
 * @param nativeDenom - Native denom constant (e.g. RUNE_DENOM, CACAO_DENOM, ATOM_DENOM)
 */
export const createVultisigCosmosTx = (
  chainName: string,
  getDenom: GetDenomFn,
  nativeDenom: string
): (({ params }: { network: Network; params: CosmosSendParams }) => TxHashLD) => {
  return ({ params }): TxHashLD => {
    const { asset, recipient, amount, memo } = params

    const vaultId = appWalletService.getActiveVaultId()
    if (!vaultId) {
      logger.error(`${chainName} tx failed: no active vault`)
      return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'No active Vultisig vault' }))
    }

    // Use xchainjs getDenom to resolve the on-chain denom, then compare to native
    const denom = getDenom(asset)
    const id = denom && denom !== nativeDenom ? denom : undefined

    // Native chain deposits (RUNE on THOR, CACAO on MAYA) use MsgDeposit, not MsgSend.
    // These have no receiver (pool address is empty). The SDK uses the sender as signer.
    const isDeposit = !recipient

    const txParams: SendTransactionParams = {
      vaultId,
      chain: chainName,
      receiver: recipient || '',
      amount: amount.amount().toFixed(),
      memo,
      decimals: amount.decimal,
      ticker: asset.ticker,
      id,
      isDeposit
    }

    logger.info(`${chainName} sendTransaction via SDK pipeline`, {
      receiver: recipient || '(deposit - no receiver)',
      amount: amount.amount().toFixed(),
      memo: memo || '(none)',
      vaultId,
      ticker: asset.ticker,
      id: id || '(native)',
      isDeposit
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
