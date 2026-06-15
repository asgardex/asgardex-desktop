import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { isSecuredAsset, isSynthAsset, isTradeAsset } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ASGARDEX_ONECLICK_API_KEY } from '../../../../shared/const'
import { isCacaoAsset, isRuneNativeAsset } from '../../../helpers/assetHelper'
import { getAssetChain } from '../../../helpers/chainHelper'
import { logger } from '../../../helpers/logger'
import { liveData } from '../../../helpers/rx/liveData'
import { service as mayaMidgardService } from '../../midgard/mayaMidgard/service'
import { service as midgardService } from '../../midgard/thorMidgard/service'
import { getTxStatus$ } from '../../thorchain'
import { ChainTxFeeOption } from '../const'
import { SendTxParams, StreamingTxState, StreamingTxState$, SwapCFTxState$, SwapTxParams, SwapTxState$ } from '../types'
import { sendPoolTx$, sendTx$ } from './common'

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
  protocol,
  sendMax
}: SwapTxParams): SwapTxState$ => {
  const { chain } = getAssetChain(asset, protocol)
  const requests$ = Rx.of(poolAddresses).pipe(
    // 1. Validate pool address or node
    RxOp.switchMap((poolAddresses) =>
      Rx.iif(
        // Boolean condition to check if the asset type matches the chain requirements
        () =>
          protocol === THORChain
            ? isRuneNativeAsset(asset) || isSynthAsset(asset) || isTradeAsset(asset) || isSecuredAsset(asset)
            : isCacaoAsset(asset) || isSynthAsset(asset) || isTradeAsset(asset),

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
        protocol,
        sendMax
      })
    ),
    // Map the result to the expected SwapTx structure
    RxOp.map((txHashRD) => ({ swapTx: txHashRD })),
    // Handle errors and map them to the expected SwapTx structure
    RxOp.catchError((error) => Rx.of({ swapTx: RD.failure(error) }))
  )

  return requests$
}

/**
 * CF Swaps do 1 step:
 *
 * 2. Send swap transaction
 */
export const swapCF$ = ({
  asset,
  amount,
  memo,
  walletType,
  sender,
  recipient,
  walletAccount,
  walletIndex,
  hdMode,
  sendMax
}: SendTxParams): SwapCFTxState$ => {
  return Rx.of(RD.pending).pipe(
    RxOp.switchMap(() => {
      return sendTx$({
        walletType,
        asset,
        recipient,
        amount,
        memo,
        feeOption: ChainTxFeeOption.SWAP,
        sender,
        walletAccount,
        walletIndex,
        hdMode,
        allowOwnerOffCurve: true,
        sendMax
      })
    }),
    RxOp.map((txHashRD) => {
      return { swapTx: txHashRD }
    }),
    RxOp.catchError((error) => {
      return Rx.of({ swapTx: RD.failure(error) })
    })
  )
}

/**
 * Registers a 1Click deposit with NEAR's chain abstraction backend. The on-chain
 * transfer alone isn't enough — 1Click needs the tx hash + deposit address mapped
 * to the quote so they can bridge to the destination chain. Failure here doesn't
 * roll back the transfer (it's already on-chain); we log and surface a warning so
 * the user knows the deposit may need to be re-registered manually.
 */
const ONECLICK_SUBMIT_DEPOSIT_URL = 'https://1click.chaindefuser.com/v0/deposit/submit'
// Abort a hung submitDeposit — this call runs inside the swap flow after the
// on-chain send, so a fetch that never settles would leave the swap progress
// pending forever. A timeout rejects into the catchError below instead.
const ONECLICK_SUBMIT_DEPOSIT_TIMEOUT_MS = 15_000

const submitOneClickDeposit = async (txHash: string, depositAddress: string): Promise<void> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ASGARDEX_ONECLICK_API_KEY) headers['Authorization'] = `Bearer ${ASGARDEX_ONECLICK_API_KEY}`
  const resp = await fetch(ONECLICK_SUBMIT_DEPOSIT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ txHash, depositAddress }),
    signal: AbortSignal.timeout(ONECLICK_SUBMIT_DEPOSIT_TIMEOUT_MS)
  })
  if (!resp.ok) throw new Error(`1Click submitDeposit failed: ${resp.status} ${resp.statusText}`)
}

/**
 * OneClick (NEAR Intents) swaps: 2 steps
 *
 * 1. Send a plain transfer to the deposit address from the quote (no memo).
 * 2. POST submitDeposit so 1Click's backend knows to bridge it to the destination.
 *
 * If step 2 fails after step 1 succeeded, the tx hash is preserved because the
 * funds are already on the wire. 1Click's backend can usually still pick up the
 * deposit by polling on-chain, but the user should be told it may need a manual
 * heads-up via 1Click support.
 */
export const swapOneClick$ = ({
  asset,
  amount,
  walletType,
  sender,
  recipient,
  walletAccount,
  walletIndex,
  hdMode,
  sendMax
}: SendTxParams): SwapCFTxState$ => {
  return Rx.of(RD.pending).pipe(
    RxOp.switchMap(() =>
      sendTx$({
        walletType,
        asset,
        recipient,
        amount,
        memo: '',
        feeOption: ChainTxFeeOption.SWAP,
        sender,
        walletAccount,
        walletIndex,
        hdMode,
        allowOwnerOffCurve: true,
        sendMax
      })
    ),
    RxOp.switchMap((txHashRD) => {
      if (!RD.isSuccess(txHashRD)) return Rx.of({ swapTx: txHashRD })
      const txHash = txHashRD.value
      return Rx.from(submitOneClickDeposit(txHash, recipient)).pipe(
        RxOp.map(() => ({ swapTx: txHashRD })),
        RxOp.catchError((err) => {
          logger.warn('1Click submitDeposit failed; tx is on-chain but may need manual registration', {
            txHash,
            depositAddress: recipient,
            error: err instanceof Error ? err.message : String(err)
          })
          return Rx.of({ swapTx: txHashRD })
        })
      )
    }),
    RxOp.catchError((error) => Rx.of({ swapTx: RD.failure(error) }))
  )
}

export const streamingSwap$ = (txhash: string): StreamingTxState$ => {
  return getTxStatus$(txhash).pipe(
    RxOp.map((txStagesRD): StreamingTxState => {
      return { streamingTx: txStagesRD }
    })
  )
}
