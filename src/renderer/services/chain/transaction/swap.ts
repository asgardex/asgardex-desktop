import * as RD from '@devexperts/remote-data-ts'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { isSynthAsset } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isRuneNativeAsset } from '../../../helpers/assetHelper'
import { liveData } from '../../../helpers/rx/liveData'
import { service as midgardService } from '../../midgard/service'
import { getTxStatus$ } from '../../thorchain'
import { ChainTxFeeOption } from '../const'
import { StreamingTxState, StreamingTxState$, SwapTxParams, SwapTxState$ } from '../types'
import { sendPoolTx$ } from './common'

const { pools: midgardPoolsService, validateNode$ } = midgardService

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
  walletIndex,
  hdMode
}: SwapTxParams): SwapTxState$ => {
  const { chain } = asset.synth ? AssetRuneNative : asset

  const requests$ = Rx.of(poolAddresses).pipe(
    // 1. Validate pool address or node
    RxOp.switchMap((poolAddresses) =>
      Rx.iif(
        () => isRuneNativeAsset(asset) || isSynthAsset(asset),
        validateNode$(),
        midgardPoolsService.validatePool$(poolAddresses, chain)
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
        walletIndex,
        hdMode
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
