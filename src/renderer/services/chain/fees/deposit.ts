import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, Asset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as RxOp from 'rxjs/operators'

import { Dex } from '../../../../shared/api/types'
import { eqOAsset } from '../../../helpers/fp/eq'
import { liveData } from '../../../helpers/rx/liveData'
import { observableState } from '../../../helpers/stateHelper'
import * as MAYA from '../../mayachain'
import * as THOR from '../../thorchain'
import { reloadInboundAddresses } from '../../thorchain'
import { SaverDepositFeesHandler, SaverWithdrawFeesHandler, SymDepositFeesHandler } from '../types'
import { poolOutboundFee$, poolInboundFee$ } from './common'

// update this to suit MayaChainSwap

// State to reload sym deposit fees
const {
  get$: reloadSymDepositFees$,
  get: reloadSymDepositFeesState,
  set: _reloadSymDepositFees
} = observableState<O.Option<AnyAsset>>(O.none)

// Triggers reloading of deposit fees
const reloadSymDepositFees = (asset: AnyAsset, dex: Dex) => {
  // (1) update reload state only, if prev. vs. current assets are different
  if (!eqOAsset.equals(O.some(asset), reloadSymDepositFeesState())) {
    _reloadSymDepositFees(O.some(asset))
  }
  // (2) Reload fees for RUNE
  dex.chain === THORChain ? THOR.reloadFees() : MAYA.reloadFees()
  // (3) Reload fees for asset, which are provided via `inbound_addresses` endpoint
  reloadInboundAddresses()
}

const symDepositFees$: SymDepositFeesHandler = (initialAsset, dex) => {
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
          runeInFee: poolInboundFee$(dex.asset, ''),
          assetInFee: poolInboundFee$(asset, ''),
          runeOutFee: poolOutboundFee$(dex.asset),
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

// State to reload Saver deposit fees
const {
  get$: reloadSaverDepositFees$,
  get: reloadSaverDepositFeesState,
  set: _reloadSaverDepositFees
} = observableState<O.Option<AnyAsset>>(O.none)

// Triggers reloading of deposit fees
const reloadSaverDepositFee = (asset: AnyAsset) => {
  // (1) update reload state only, if prev. vs. current assets are different
  if (!eqOAsset.equals(O.some(asset), reloadSaverDepositFeesState())) {
    _reloadSaverDepositFees(O.some(asset))
  }
  // (3) Reload fees for asset, which are provided via `inbound_addresses` endpoint
  reloadInboundAddresses()
}
const saverDepositFee$: SaverDepositFeesHandler = (initialAsset) => {
  return FP.pipe(
    reloadSaverDepositFees$,
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
          assetInFee: poolInboundFee$(asset, ''),
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

// State to reload Saver withdraw fees
const {
  get$: reloadSaverWithdrawFees$,
  get: reloadSaverWithdrawFeesState,
  set: _reloadSaverWithdrawFees
} = observableState<O.Option<Asset>>(O.none)

// Triggers reloading of withdraw fees
const reloadSaverWithdrawFee = (asset: Asset) => {
  // (1) update reload state only, if prev. vs. current assets are different
  if (!eqOAsset.equals(O.some(asset), reloadSaverWithdrawFeesState())) {
    _reloadSaverWithdrawFees(O.some(asset))
  }
  // (3) Reload fees for asset, which are provided via `inbound_addresses` endpoint
  reloadInboundAddresses()
}

const saverWithdrawFee$: SaverWithdrawFeesHandler = (initialAsset) => {
  return FP.pipe(
    reloadSaverWithdrawFees$,
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
          assetInFee: poolInboundFee$(asset, ''),
          assetOutFee: poolOutboundFee$(asset)
        }),
        liveData.map(({ assetInFee, assetOutFee }) => ({
          asset: assetInFee.asset,
          inFee: assetInFee.amount,
          outFee: assetOutFee.amount
        }))
      )
    })
  )
}

export {
  symDepositFees$,
  saverDepositFee$,
  reloadSymDepositFees,
  reloadSaverDepositFee,
  saverWithdrawFee$,
  reloadSaverWithdrawFee
}
