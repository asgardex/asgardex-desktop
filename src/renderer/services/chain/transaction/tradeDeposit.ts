import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, TokenAsset } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { getEVMTokenAddressForChain, isRuneNativeAsset } from '../../../helpers/assetHelper'
import { getTradeMemo, Action } from '../../../helpers/memoHelper'
import { liveData } from '../../../helpers/rx/liveData'
import { observableState } from '../../../helpers/stateHelper'
import { service as mayaMidgardService } from '../../midgard/mayaMidgard/service'
import { service as midgardService } from '../../midgard/thorMidgard/service'
import { ChainTxFeeOption, INITIAL_DEPOSIT_STATE } from '../const'
import { DepositParams, DepositState, DepositState$ } from '../types'
import { sendPoolTx$, poolTxStatusByChain$ } from './common'

const { pools: midgardPoolsService, validateNode$ } = midgardService
const { pools: mayaMidgardPoolsService, validateNode$: mayaValidateNode$ } = mayaMidgardService

/**
 * Trade deposit stream does 3 steps:
 *
 * 1. Generate trade memo with user address
 * 2. Send deposit transaction to inbound address
 * 3. Check status of deposit transaction
 *
 * @returns DepositState$ - Observable state to reflect loading status
 *
 */
export const tradeDeposit$ = ({
  poolAddress,
  asset,
  amount,
  memo,
  sender,
  walletType,
  walletAccount,
  walletIndex,
  hdMode,
  protocol
}: DepositParams): DepositState$ => {
  // total of progress
  const total = O.some(100)

  const { chain } = asset

  // Observable state of loading process
  // we start with progress of 25%
  const {
    get$: getState$,
    get: getState,
    set: setState
  } = observableState<DepositState>({
    ...INITIAL_DEPOSIT_STATE,
    deposit: RD.progress({ loaded: 25, total })
  })

  // All requests will be done in a sequence
  // and `DepositState` will be updated step by step
  const requests$ = Rx.of(poolAddress).pipe(
    // 1. validate pool address or node
    RxOp.switchMap((poolAddresses) =>
      Rx.iif(
        () => isRuneNativeAsset(asset),
        // We don't have a RUNE pool, so we just validate current connected node
        protocol === THORChain ? validateNode$() : mayaValidateNode$(),
        // in other case we have to validate pool address
        protocol === THORChain
          ? midgardPoolsService.validatePool$(poolAddresses, chain)
          : mayaMidgardPoolsService.validatePool$(poolAddresses, chain)
      )
    ),
    liveData.chain((_) => {
      // Update progress
      setState({ ...getState(), step: 2, deposit: RD.progress({ loaded: 50, total }) })
      // 2. send deposit tx
      return sendPoolTx$({
        sender,
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        router: poolAddress.router,
        asset,
        recipient: poolAddress.address,
        amount,
        memo,
        feeOption: ChainTxFeeOption.DEPOSIT,
        protocol
      })
    }),
    liveData.chain((txHash) => {
      // Update state
      setState({
        ...getState(),
        step: 3,
        depositTx: RD.success(txHash),
        deposit: RD.progress({ loaded: 75, total })
      })
      // 3. check tx finality by polling its tx data
      const assetAddress: O.Option<Address> = getEVMTokenAddressForChain(chain, asset as TokenAsset)
      return poolTxStatusByChain$({ txHash, chain, assetAddress })
    }),
    // Update state
    liveData.map((_) => setState({ ...getState(), deposit: RD.success(true) })),

    // Add failures to state
    liveData.mapLeft((apiError) => {
      setState({ ...getState(), deposit: RD.failure(apiError) })
      return apiError
    }),
    // handle errors
    RxOp.catchError((error) => {
      setState({ ...getState(), deposit: RD.failure(error) })
      return Rx.EMPTY
    })
  )
  // We do need to fake progress in last step
  // Note: `requests$` has to be added to subscribe it once (it won't do anything otherwise)
  return Rx.combineLatest([getState$, requests$]).pipe(
    RxOp.switchMap(([state, _]) =>
      FP.pipe(
        // check deposit state to update its `pending` state (if needed)
        state.deposit,
        RD.fold(
          // ignore initial state + return same state (no changes)
          () => Rx.of(state),
          // For `pending` state we fake progress state in last third
          (oProgress) =>
            FP.pipe(
              // Just a timer used to update loaded state (in pending state only)
              Rx.interval(1500),
              RxOp.map(() =>
                FP.pipe(
                  oProgress,
                  O.map(({ loaded }): DepositState => {
                    // From 75 to 97 we count progress with small steps, but stop it at 98
                    const updatedLoaded = loaded >= 75 && loaded <= 97 ? Math.min(97, loaded + 1) : loaded
                    return { ...state, deposit: RD.progress({ loaded: updatedLoaded, total }) }
                  }),
                  O.getOrElse(() => state)
                )
              )
            ),
          // ignore `failure` state + return same state (no changes)
          () => Rx.of(state),
          // ignore `success` state + return same state (no changes)
          () => Rx.of(state)
        )
      )
    ),
    RxOp.startWith({ ...getState() })
  )
}

/**
 * Generate trade memo with the user's protocol address
 * @param userAddress User's address for the protocol
 * @returns Trade memo string
 */
export const generateTradeMemo = (userAddress: Address): string => {
  return getTradeMemo(Action.add, userAddress)
}
