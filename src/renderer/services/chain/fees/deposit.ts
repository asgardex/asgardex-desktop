import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as RxOp from 'rxjs/operators'

import { eqOAsset } from '../../../helpers/fp/eq'
import { liveData } from '../../../helpers/rx/liveData'
import { observableState } from '../../../helpers/stateHelper'
import * as MAYA from '../../mayachain'
import * as THOR from '../../thorchain'
import { reloadInboundAddresses } from '../../thorchain'
import { SymDepositFeesHandler } from '../types'
import { poolOutboundFee$, poolInboundFee$ } from './common'

// State to reload sym deposit fees
const {
  get$: reloadSymDepositFees$,
  get: reloadSymDepositFeesState,
  set: _reloadSymDepositFees
} = observableState<O.Option<AnyAsset>>(O.none)

// Triggers reloading of deposit fees
const reloadSymDepositFees = (asset: AnyAsset, protocolAsset: AnyAsset) => {
  // (1) update reload state only, if prev. vs. current assets are different
  if (!eqOAsset.equals(O.some(asset), reloadSymDepositFeesState())) {
    _reloadSymDepositFees(O.some(asset))
  }
  // (2) Reload fees for RUNE
  protocolAsset.chain === THORChain ? THOR.reloadFees(true) : MAYA.reloadFees()
  // (3) Reload fees for asset, which are provided via `inbound_addresses` endpoint
  reloadInboundAddresses()
}

const symDepositFees$: SymDepositFeesHandler = (initialAsset, protocolAsset) => {
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
          runeInFee: poolInboundFee$(protocolAsset, ''),
          assetInFee: poolInboundFee$(asset, ''),
          runeOutFee: poolOutboundFee$(protocolAsset),
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

// State to reload deposit fees
const {
  get$: reloadDepositFees$,
  get: reloadDepositFeesState,
  set: _reloadDepositFees
} = observableState<O.Option<AnyAsset>>(O.none)

// Triggers reloading of deposit fees
const reloadDepositFees = (asset: AnyAsset) => {
  if (!eqOAsset.equals(O.some(asset), reloadDepositFeesState())) {
    _reloadDepositFees(O.some(asset))
  }
  reloadInboundAddresses()
}

const depositFees$ = (initialAsset: AnyAsset) =>
  FP.pipe(
    reloadDepositFees$,
    RxOp.debounceTime(300),
    RxOp.switchMap((oAsset) =>
      FP.pipe(O.getOrElse(() => initialAsset)(oAsset), (asset) =>
        FP.pipe(
          liveData.sequenceS({
            inFee: poolInboundFee$(asset, '')
          }),
          liveData.map(({ inFee }) => inFee.amount) // Return BaseAmount
        )
      )
    )
  )
export { symDepositFees$, reloadSymDepositFees, depositFees$, reloadDepositFees }
