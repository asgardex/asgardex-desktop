import { Asset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as RxOp from 'rxjs/operators'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { eqOAsset } from '../../../helpers/fp/eq'
import { liveData } from '../../../helpers/rx/liveData'
import { observableState } from '../../../helpers/stateHelper'
import * as THOR from '../../thorchain'
import { reloadInboundAddresses } from '../../thorchain'
import { AsymDepositFeesHandler, SymDepositFeesHandler } from '../types'
import { poolOutboundFee$, poolInboundFee$ } from './common'

// State to reload sym deposit fees
const {
  get$: reloadSymDepositFees$,
  get: reloadSymDepositFeesState,
  set: _reloadSymDepositFees
} = observableState<O.Option<Asset>>(O.none)

// Triggers reloading of deposit fees
const reloadSymDepositFees = (asset: Asset) => {
  // (1) update reload state only, if prev. vs. current assets are different
  if (!eqOAsset.equals(O.some(asset), reloadSymDepositFeesState())) {
    _reloadSymDepositFees(O.some(asset))
  }
  // (2) Reload fees for RUNE
  THOR.reloadFees()
  // (3) Reload fees for asset, which are provided via `inbound_addresses` endpoint
  reloadInboundAddresses()
}

const symDepositFees$: SymDepositFeesHandler = (initialAsset) => {
  return FP.pipe(
    reloadSymDepositFees$,
    RxOp.debounceTime(300),
    RxOp.switchMap((oAsset) => {
      // Since `oAsset` is `none` by default,
      // `initialAsset` will be used as first value
      const asset = FP.pipe(
        oAsset,
        O.getOrElse(() => initialAsset)
      )

      return FP.pipe(
        liveData.sequenceS({
          runeInFee: poolInboundFee$(AssetRuneNative),
          assetInFee: poolInboundFee$(asset),
          runeOutFee: poolOutboundFee$(AssetRuneNative),
          assetOutFee: poolOutboundFee$(asset)
        }),
        liveData.map(({ runeInFee, assetInFee, runeOutFee, assetOutFee }) => ({
          rune: { inFee: runeInFee.amount, outFee: runeOutFee.amount, refundFee: runeOutFee.amount },
          asset: {
            asset: assetInFee.asset,
            inFee: assetInFee.amount,
            outFee: assetOutFee.amount,
            refundFee: assetOutFee.amount
          }
        }))
      )
    })
  )
}

// State to reload Asym and Saver deposit fees
const {
  get$: reloadAsymDepositFees$,
  get: reloadAsymDepositFeesState,
  set: _reloadAsymDepositFees
} = observableState<O.Option<Asset>>(O.none)

// Triggers reloading of deposit fees
const reloadAsymDepositFee = (asset: Asset) => {
  // (1) update reload state only, if prev. vs. current assets are different
  if (!eqOAsset.equals(O.some(asset), reloadAsymDepositFeesState())) {
    _reloadAsymDepositFees(O.some(asset))
  }
  // (3) Reload fees for asset, which are provided via `inbound_addresses` endpoint
  reloadInboundAddresses()
}
const asymDepositFee$: AsymDepositFeesHandler = (initialAsset) => {
  return FP.pipe(
    reloadAsymDepositFees$,
    RxOp.debounceTime(300),
    RxOp.switchMap((oAsset) => {
      // Since `oAsset` is `none` by default,
      // `initialAsset` will be used as first value
      const asset = FP.pipe(
        oAsset,
        O.getOrElse(() => initialAsset)
      )

      return FP.pipe(
        liveData.sequenceS({
          assetInFee: poolInboundFee$(asset),
          assetOutFee: poolOutboundFee$(asset)
        }),
        liveData.map(({ assetInFee, assetOutFee }) => ({
          asset: {
            asset: assetInFee.asset,
            inFee: assetInFee.amount,
            outFee: assetOutFee.amount,
            refundFee: assetOutFee.amount
          }
        }))
      )
    })
  )
}

export { symDepositFees$, asymDepositFee$, reloadSymDepositFees, reloadAsymDepositFee }
