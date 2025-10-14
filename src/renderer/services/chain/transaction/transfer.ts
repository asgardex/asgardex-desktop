import * as RD from '@devexperts/remote-data-ts'
import { TokenAsset } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { getEVMTokenAddressForChain } from '../../../helpers/assetHelper'
import { liveData } from '../../../helpers/rx/liveData'
import { observableState } from '../../../helpers/stateHelper'
import { ErrorId } from '../../wallet/types'
import { INITIAL_SEND_STATE } from '../const'
import { SendTxStateHandler, SendTxState } from '../types'
import { sendTx$, poolTxStatusByChain$ } from './common'

/**
 * Send TX
 */
export const transfer$: SendTxStateHandler = (params) => {
  // total of progress
  const total = O.some(100)
  const { asset } = params

  // For status checking, always use the asset's native chain, not protocol chain
  const nativeChain = asset.chain

  // Observable state of `SendTxState`
  const {
    get$: getState$,
    get: getState,
    set: setState
  } = observableState<SendTxState>({
    ...INITIAL_SEND_STATE,
    status: RD.progress({ loaded: 25, total }),
    steps: { current: 1, total: 3 }
  })

  // All requests will be done in a sequence
  // and `SendTxState` will be updated step by step
  const requests$ = Rx.of(true).pipe(
    // Step 1: Health check (minimal validation for send transactions)
    RxOp.switchMap(() => {
      // For send transactions, health check is just a basic validation
      // that the params are valid (no complex pool/node validation needed)
      return Rx.of(true)
    }),
    RxOp.map((_) => {
      // Update progress: move to step 2
      setState({
        ...getState(),
        steps: { current: 2, total: 3 },
        status: RD.progress({ loaded: 40, total })
      })
      return true
    }),
    // Step 2: Send transaction
    RxOp.switchMap((_) => sendTx$(params)),
    liveData.map((txHash) => {
      // Update state: move to step 3, update progress
      setState({
        ...getState(),
        steps: { current: 3, total: 3 },
        status: RD.progress({ loaded: 70, total })
      })
      return txHash
    }),
    // Step 3: Check transaction status
    liveData.chain((txHash) => {
      // Update progress for status checking
      setState({
        ...getState(),
        status: RD.progress({ loaded: 85, total })
      })
      // Check transaction status on native chain
      // Get asset address for EVM chains (same pattern as deposit)
      const assetAddress = getEVMTokenAddressForChain(nativeChain, asset as TokenAsset)
      return poolTxStatusByChain$({ txHash, chain: nativeChain, assetAddress })
    }),
    // Step 3 completed: transaction confirmed
    liveData.map((tx) => {
      // Update state: transaction successful
      setState({ ...getState(), status: RD.success(tx.hash) })
      return tx
    }),
    // Add failures to state
    liveData.mapLeft((apiError) => {
      setState({ ...getState(), status: RD.failure(apiError) })
      return apiError
    }),
    // handle errors
    RxOp.catchError((error) => {
      setState({
        ...getState(),
        status: RD.failure({
          errorId: ErrorId.SEND_TX,
          msg: error?.msg ?? error.toString()
        })
      })
      return Rx.EMPTY
    })
  )

  return FP.pipe(
    Rx.combineLatest([getState$, requests$]),
    RxOp.switchMap(() => Rx.of(getState()))
  )
}
