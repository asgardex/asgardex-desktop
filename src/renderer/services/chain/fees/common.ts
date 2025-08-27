import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain } from '@xchainjs/xchain-solana'
import { isTCYAsset, THORChain } from '@xchainjs/xchain-thorchain'
import {
  Address,
  AnyAsset,
  Asset,
  AssetType,
  BaseAmount,
  baseAmount,
  Chain,
  isSecuredAsset,
  isSynthAsset
} from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { isChainOfThor } from '../../../../shared/utils/chain'
import { isCacaoAsset, isRujiAsset, isRuneNativeAsset } from '../../../helpers/assetHelper'
import { liveData } from '../../../helpers/rx/liveData'
import * as ARB from '../../arb'
import * as AVAX from '../../avax'
import * as BASE from '../../base'
import * as BTC from '../../bitcoin'
import * as BCH from '../../bitcoincash'
import * as BSC from '../../bsc'
import * as ADA from '../../cardano'
import { FeesLD } from '../../clients'
import * as COSMOS from '../../cosmos'
import * as DASH from '../../dash'
import * as DOGE from '../../doge'
import * as ETH from '../../ethereum'
import * as KUJI from '../../kuji'
import * as LTC from '../../litecoin'
import * as MAYA from '../../mayachain'
import { service as midgardMayaService } from '../../midgard/mayaMigard/service'
import { service as midgardService } from '../../midgard/thorMidgard/service'
import * as XRD from '../../radix'
import * as XRP from '../../ripple'
import * as SOL from '../../solana'
import { ZERO_ADDRESS } from '../../solana/fees'
import * as THOR from '../../thorchain'
import { FeesWithRatesLD } from '../../utxo/types'
import * as ZEC from '../../zcash'
import { PoolFeeLD } from '../types'

const {
  pools: { outboundAssetFeeByChain$ }
} = midgardService
const {
  pools: { outboundAssetFeeByChain$: outboundAssetFeeByChainMaya$ }
} = midgardMayaService

/**
 * Fees for pool outbound txs (swap/deposit/withdraw/earn) tobefixed
 */
export const poolOutboundFee$ = (asset: AnyAsset): PoolFeeLD => {
  // special case for RUNE - not provided in `inbound_addresses` endpoint
  if (
    isRuneNativeAsset(asset) ||
    asset.type === AssetType.TRADE ||
    asset.type === AssetType.SECURED ||
    isTCYAsset(asset)
  ) {
    return FP.pipe(
      THOR.fees$(),
      liveData.map((fees) => ({ amount: fees.fast.times(3), asset: AssetRuneNative }))
    )
  } else if (isCacaoAsset(asset) || asset.type === AssetType.SYNTH) {
    return FP.pipe(
      MAYA.fees$(),
      liveData.map((fees) => ({ amount: fees.fast.times(3), asset: AssetCacao }))
    )
  } else {
    const { chain } = asset
    const outboundFee = isChainOfThor(chain) ? outboundAssetFeeByChain$(chain) : outboundAssetFeeByChainMaya$(chain)
    return outboundFee
  }
}
/**
 * Fees for pool inbound txs (swap/deposit/withdraw/earn)
 */
export const poolInboundFee$ = (asset: AnyAsset, memo: string): PoolFeeLD => {
  if (isSynthAsset(asset)) {
    return FP.pipe(
      MAYA.fees$(),
      liveData.map((fees) => ({ amount: fees.fast, asset: AssetCacao }))
    )
  }
  if (isSecuredAsset(asset)) {
    return FP.pipe(
      THOR.fees$(),
      liveData.map((fees) => ({ amount: fees.fast, asset: AssetRuneNative }))
    )
  }
  if (isTCYAsset(asset) || isRujiAsset(asset)) {
    return FP.pipe(
      THOR.fees$(),
      liveData.map((fees) => ({ amount: fees.fast, asset: AssetRuneNative }))
    )
  }
  switch (asset.chain) {
    case DOGEChain:
      return FP.pipe(
        DOGE.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  DOGE.feesWithRates$(address.address, memo),
                  liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )

    case LTCChain:
      return FP.pipe(
        LTC.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  LTC.feesWithRates$(address.address, memo),
                  liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case GAIAChain:
      return FP.pipe(
        COSMOS.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case ETHChain:
      return FP.pipe(
        ETH.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  ETH.fees$({ amount: baseAmount(1), recipient: address.address }),
                  liveData.map((fees) => ({ asset, amount: fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case ARBChain:
      return FP.pipe(
        ARB.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  ARB.fees$({ amount: baseAmount(1), recipient: address.address }),
                  liveData.map((fees) => ({ asset, amount: fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case BASEChain:
      return FP.pipe(
        BASE.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  BASE.fees$({ amount: baseAmount(1), recipient: address.address }),
                  liveData.map((fees) => ({ asset, amount: fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case AVAXChain:
      return FP.pipe(
        AVAX.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  AVAX.fees$({ amount: baseAmount(1), recipient: address.address }),
                  liveData.map((fees) => ({ asset, amount: fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case BSCChain:
      return FP.pipe(
        BSC.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  BSC.fees$({ amount: baseAmount(1), recipient: address.address }),
                  liveData.map((fees) => ({ asset, amount: fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case BTCChain:
      return FP.pipe(
        BTC.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  BTC.feesWithRates$(address.address, memo),
                  liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case BCHChain:
      return FP.pipe(
        BCH.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  BCH.feesWithRates$(address.address, memo),
                  liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case THORChain:
      return FP.pipe(
        THOR.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case MAYAChain:
      return FP.pipe(
        MAYA.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case SOLChain:
      return FP.pipe(
        SOL.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No recipient address available'))),
              (address) =>
                FP.pipe(
                  SOL.fees$({
                    amount: baseAmount(1),
                    recipient: address.address
                  }),
                  liveData.map((fees) => ({ asset, amount: fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case KUJIChain:
      return FP.pipe(
        KUJI.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case ADAChain:
      return FP.pipe(
        ADA.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case XRPChain:
      return FP.pipe(
        XRP.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case RadixChain:
      return FP.pipe(
        XRD.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case DASHChain:
      return FP.pipe(
        DASH.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  DASH.feesWithRates$(address.address, memo),
                  liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    case ZECChain:
      return FP.pipe(
        ZEC.address$.pipe(
          RxOp.switchMap(
            O.fold(
              () => Rx.of(RD.failure(new Error('No address available'))),
              (address) =>
                FP.pipe(
                  ZEC.feesWithRates$(address.address, memo),
                  liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
                )
            )
          ),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      )
    default:
      return FP.pipe(
        poolOutboundFee$(asset),
        liveData.map(({ asset, amount }) => ({ asset, amount: amount.div(3) }))
      )
  }
}

export const utxoFeesWithRates$ = (asset: Asset, address: string): FeesWithRatesLD => {
  switch (asset.chain) {
    case BTCChain:
      return BTC.feesWithRates$(address)
    case BCHChain:
      return BCH.feesWithRates$(address)
    case DOGEChain:
      return DOGE.feesWithRates$(address)
    case LTCChain:
      return LTC.feesWithRates$(address)
    case DASHChain:
      return DASH.feesWithRates$(address)
    case ZECChain:
      return ZEC.feesWithRates$(address)
    case ADAChain:
      return ADA.feesWithRates$(address)
    default:
      return BTC.feesWithRates$(address)
  }
}

export const reloadUtxoFeesWithRates$ = (asset: Asset) => {
  switch (asset.chain) {
    case BTCChain:
      return BTC.reloadFeesWithRates
    case BCHChain:
      return BCH.reloadFeesWithRates
    case DASHChain:
      return DASH.reloadFeesWithRates
    case DOGEChain:
      return DOGE.reloadFeesWithRates
    case LTCChain:
      return LTC.reloadFeesWithRates
    case ZECChain:
      return ZEC.reloadFeesWithRates
    case ADAChain:
      return ADA.reloadFeesWithRates
    default:
      return BTC.reloadFeesWithRates
  }
}

/**
 * Centralized EVM fee estimation for standalone ledger mode support
 */
export const evmFees$ = (params: {
  chain: Chain
  asset: AnyAsset
  amount: BaseAmount
  recipient: Address
  from: Address
}): FeesLD => {
  const { chain, asset, amount, recipient, from } = params

  if (!asset) {
    return Rx.of(RD.failure(new Error('Asset is undefined for fee estimation')))
  }

  switch (chain) {
    case ETHChain:
      return ETH.fees$({ asset, amount, recipient, from })
    case ARBChain:
      return ARB.fees$({ asset, amount, recipient, from })
    case AVAXChain:
      return AVAX.fees$({ asset, amount, recipient, from })
    case BASEChain:
      return BASE.fees$({ asset, amount, recipient, from })
    case BSCChain:
      return BSC.fees$({ asset, amount, recipient, from })
    default:
      // Fallback to ETH for unknown EVM chains
      return ETH.fees$({ asset, amount, recipient, from })
  }
}

/**
 * Centralized fee estimation for standalone ledger mode support
 * Supports multiple chain types: Cosmos (THOR, GAIA, KUJI), and others (ADA, XRP, Radix, SOL)
 */
export const standaloneLedgerFees$ = (params: { chain: Chain; amount: BaseAmount; recipient: Address }): FeesLD => {
  const { chain, amount, recipient } = params

  switch (chain) {
    case THORChain:
      return THOR.fees$()
    case MAYAChain:
      return MAYA.fees$()
    case GAIAChain:
      return COSMOS.fees$()
    case KUJIChain:
      return KUJI.fees$()
    case ADAChain:
      return ADA.fees$()
    case XRPChain:
      return XRP.fees$()
    case RadixChain:
      return XRD.fees$()
    case SOLChain:
      return SOL.fees$({ amount, recipient })
    default:
      // Fallback to THOR for unknown chains
      return THOR.fees$()
  }
}

/**
 * Centralized reload function for standalone ledger mode chains
 */
export const reloadStandaloneLedgerFees = (chain: Chain): void => {
  switch (chain) {
    case THORChain:
      THOR.reloadFees(true)
      break
    case MAYAChain:
      MAYA.reloadFees()
      break
    case GAIAChain:
      COSMOS.reloadFees()
      break
    case KUJIChain:
      KUJI.reloadFees()
      break
    case ADAChain:
      ADA.reloadFees()
      break
    case XRPChain:
      XRP.reloadFees()
      break
    case RadixChain:
      XRD.reloadFees()
      break
    case SOLChain:
      SOL.reloadFees({ amount: baseAmount(1), recipient: ZERO_ADDRESS })
      break
    default:
      // Fallback to THOR for unknown chains
      THOR.reloadFees(true)
  }
}
