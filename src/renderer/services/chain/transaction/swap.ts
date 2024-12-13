import * as RD from '@devexperts/remote-data-ts'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AssetType, isSynthAsset, isTradeAsset } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isCacaoAsset, isRuneNativeAsset } from '../../../helpers/assetHelper'
import { liveData } from '../../../helpers/rx/liveData'
import { service as mayaMidgardService } from '../../mayaMigard/service'
import { service as midgardService } from '../../midgard/service'
import { getTxStatus$ } from '../../thorchain'
import { ChainTxFeeOption } from '../const'
import { StreamingTxState, StreamingTxState$, SwapTxParams, SwapTxState$ } from '../types'
import { sendPoolTx$ } from './common'

const { pools: midgardPoolsService, validateNode$ } = midgardService
const { pools: mayaMidgardPoolsService, validateNode$: mayaValidateNode$ } = mayaMidgardService

/**
 * Swap does 2 steps:
 *
 * 1. Validate pool address
 * 2. Send swap transaction
 */
export const swap$ = ({
  poolAddress: poolAddresses,
  asset,
  amount,
  memo,
  walletType,
  sender,
  walletAccount,
  walletIndex,
  hdMode,
  protocol
}: SwapTxParams): SwapTxState$ => {
  const { chain } =
    asset.type === AssetType.SYNTH ? AssetCacao : asset.type === AssetType.TRADE ? { chain: THORChain } : asset

  const requests$ = Rx.of(poolAddresses).pipe(
    // 1. Validate pool address or node
    RxOp.switchMap((poolAddresses) =>
      Rx.iif(
        // Boolean condition to check if the asset type matches the chain requirements
        () =>
          protocol === THORChain
            ? isRuneNativeAsset(asset) || isSynthAsset(asset) || isTradeAsset(asset)
            : isCacaoAsset(asset) || isSynthAsset(asset),

        // If the condition is true, validate the node based on the chain type
        protocol === THORChain ? validateNode$() : mayaValidateNode$(),

        // Use the appropriate pool validation service based on the chain
        protocol === THORChain
          ? midgardPoolsService.validatePool$(poolAddresses, chain)
          : mayaMidgardPoolsService.validatePool$(poolAddresses, chain)
      )
    ),
    // 2. Send swap transaction
    liveData.chain((_) =>
      sendPoolTx$({
        walletType,
        router: poolAddresses.router,
        asset,
        recipient: poolAddresses.address,
        amount,
        memo,
        feeOption: ChainTxFeeOption.SWAP,
        sender,
        walletAccount,
        walletIndex,
        hdMode,
        protocol
      })
    ),
    // Map the result to the expected SwapTx structure
    RxOp.map((txHashRD) => ({ swapTx: txHashRD })),
    // Handle errors and map them to the expected SwapTx structure
    RxOp.catchError((error) => Rx.of({ swapTx: RD.failure(error) }))
  )

  return requests$
}

export const streamingSwap$ = (txhash: string): StreamingTxState$ => {
  return getTxStatus$(txhash).pipe(
    RxOp.map((txStagesRD): StreamingTxState => {
      return { streamingTx: txStagesRD }
    })
  )
}
