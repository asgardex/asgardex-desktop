import * as RD from '@devexperts/remote-data-ts'
import { DepositParam } from '@xchainjs/xchain-thorchain'
import { Address } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { AssetRuneNative } from '../../../shared/utils/asset'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { liveData } from '../../helpers/rx/liveData'
import { LiveData } from '../../helpers/rx/liveData'
import { observableState } from '../../helpers/stateHelper'
import { TxLD } from '../wallet/types'
import { ApiError } from '../wallet/types'
import { INITIAL_INTERACT_STATE } from './const'
import { InteractParams, InteractState, InteractState$ } from './types'

/**
 * Interact stream does 2 steps:
 *
 * 1. Send deposit transaction
 * 2. Check status of deposit transaction
 *
 * @returns InteractState$ - Observable state to reflect loading status. It provides all data we do need to display
 *
 */
export const createInteractService$ =
  (
    depositTx$: (
      _: DepositParam & {
        walletType: WalletType
        walletAccount: number
        walletIndex: number /* override walletIndex of DepositParam to avoid 'undefined' */
        hdMode: HDMode
      }
    ) => LiveData<ApiError, string>,
    getTxStatus: (txHash: string, assetAddress: O.Option<Address>) => TxLD
  ) =>
  ({ walletType, walletAccount, walletIndex, hdMode, amount, memo }: InteractParams): InteractState$ => {
    // total of progress
    const total = O.some(100)

    // Observable state of loading process
    // we start with progress of 33%
    const {
      get$: getState$,
      get: getState,
      set: setState
    } = observableState<InteractState>({
      ...INITIAL_INTERACT_STATE,
      txRD: RD.progress({ loaded: 33, total })
    })

    // All requests will be done in a sequence
    // and `InteractState` will be updated step by step
    const requests$ = FP.pipe(
      // 1. send deposit tx
      depositTx$({
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        asset: AssetRuneNative,
        amount,
        memo
      }),
      liveData.chain((txHash) => {
        // Update state
        setState({ ...getState(), step: 2, txRD: RD.progress({ loaded: 66, total }) })
        // 2. check tx finality
        return getTxStatus(txHash, O.none)
      }),
      // Update state
      liveData.map(({ hash: txHash }) => {
        return setState({ ...getState(), txRD: RD.success(txHash) })
      }),
      // Add failures to state
      liveData.mapLeft((apiError) => {
        setState({ ...getState(), txRD: RD.failure(apiError) })
        return apiError
      }),
      // handle errors
      RxOp.catchError((error) => {
        setState({ ...getState(), txRD: RD.failure(error) })
        return Rx.EMPTY
      })
    )

    return FP.pipe(
      Rx.combineLatest([getState$, requests$]),
      RxOp.switchMap(() => Rx.of(getState()))
    )
  }
