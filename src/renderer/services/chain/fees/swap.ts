import { AnyAsset, AssetType, isSynthAsset, isTradeAsset } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'
import { THORChain } from '../../../../shared/utils/chainIds'

import { ZERO_BASE_AMOUNT } from '../../../const'
import { isCacaoAsset, isRuneNativeAsset } from '../../../helpers/assetHelper'
import { getChainAsset } from '../../../helpers/chainHelper'
import { eqOSwapFeesParams } from '../../../helpers/fp/eq'
import { liveData } from '../../../helpers/rx/liveData'
import { observableState } from '../../../helpers/stateHelper'
import * as MAYA from '../../mayachain'
import * as THOR from '../../thorchain'
import { reloadInboundAddresses } from '../../thorchain'
import { SwapFeesHandler, SwapFeesParams, SwapFees } from '../types'
import { poolOutboundFee$, poolInboundFee$ } from './common'

/**
 * Returns zero swap fees
 * by given `in` / `out` assets of a swap tobeFixed
 */
export const getZeroSwapFees = ({ inAsset, outAsset }: { inAsset: AnyAsset; outAsset: AnyAsset }): SwapFees => ({
  inFee: {
    amount: ZERO_BASE_AMOUNT,
    asset: getChainAsset(
      inAsset.type === AssetType.SYNTH || inAsset.type === AssetType.TRADE ? THORChain : inAsset.chain
    )
  },
  outFee: {
    amount: ZERO_BASE_AMOUNT,
    asset: getChainAsset(
      inAsset.type === AssetType.SYNTH || inAsset.type === AssetType.TRADE ? THORChain : outAsset.chain
    )
  }
})

// state of `SwapFeesParams` used for reloading swap fees
const {
  get$: updateSwapFeesParams$,
  get: updateSwapFeesParamsState,
  set: updateSwapFeesParams
} = observableState<O.Option<SwapFeesParams>>(O.none)

// To trigger reload of swap fees
const reloadSwapFees = (params: SwapFeesParams) => {
  const { inAsset, outAsset } = params
  // if prev. vs. new states are different, update params
  if (!eqOSwapFeesParams.equals(O.some(params), updateSwapFeesParamsState())) {
    updateSwapFeesParams(O.some(params))
  }

  // (1) Check reload of fees for RUNE
  if (isRuneNativeAsset(inAsset) || isRuneNativeAsset(outAsset) || isTradeAsset(inAsset) || isTradeAsset(outAsset)) {
    THOR.reloadFees(true)
  }
  if (
    isCacaoAsset(inAsset) ||
    isCacaoAsset(outAsset) ||
    isSynthAsset(inAsset) ||
    isSynthAsset(outAsset) ||
    isTradeAsset(inAsset) ||
    isTradeAsset(outAsset)
  ) {
    MAYA.reloadFees()
  }

  // OR (2) check other fees, which all depend on outbound fees defined in `inbound_addresses`
  if (!isRuneNativeAsset(inAsset) || !isRuneNativeAsset(outAsset)) {
    reloadInboundAddresses()
  }
}

const swapFees$: SwapFeesHandler = (initialParams) => {
  // Seed each subscriber with O.none so it uses its own initialParams,
  // skipping the BehaviorSubject's replayed value which may be stale
  // from a previously viewed swap page.
  //
  // NOTE: assumes a single `swapFees$` subscriber at a time (TradingPanel and SwapView are separate routes, so
  // the old page unsubscribes before the new one subscribes). With two concurrent subscribers, one's
  // defer/finalize would reset the shared state under the other.
  //
  // The dedupe in `reloadSwapFees` compares against that same module-global state, so it is reset per
  // subscription (on start and end). Otherwise, after leaving and re-entering the swap page, a reload
  // with the same params as the stale state (e.g. quote protocol, sender) would be dropped as "unchanged"
  // while this subscriber is still on `initialParams`.
  return Rx.defer(() => {
    updateSwapFeesParams(O.none)
    return Rx.concat(Rx.of(O.none as O.Option<SwapFeesParams>), updateSwapFeesParams$.pipe(RxOp.skip(1)))
  }).pipe(
    RxOp.finalize(() => updateSwapFeesParams(O.none)),
    RxOp.debounceTime(300),
    RxOp.switchMap((oReloadParams) => {
      const { inAsset, memo, outAsset, sender, inboundProtocol, plainTransfer } = FP.pipe(
        oReloadParams,
        O.getOrElse(() => initialParams)
      )
      return liveData.sequenceS({
        inFee: poolInboundFee$(inAsset, memo, sender, inboundProtocol, plainTransfer),
        outFee: poolOutboundFee$(outAsset)
      })
    })
  )
}

export { reloadSwapFees, swapFees$ }
