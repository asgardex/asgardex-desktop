import { BNBChain } from '@xchainjs/xchain-binance'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Asset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { isCacaoAsset, isRuneNativeAsset } from '../../../helpers/assetHelper'
import { liveData } from '../../../helpers/rx/liveData'
import * as BNB from '../../binance'
import * as BTC from '../../bitcoin'
import * as BCH from '../../bitcoincash'
import * as COSMOS from '../../cosmos'
import * as DASH from '../../dash'
import * as DOGE from '../../doge'
import * as KUJI from '../../kuji'
import * as LTC from '../../litecoin'
import * as MAYA from '../../mayachain'
import { service as midgardService } from '../../midgard/service'
import * as THOR from '../../thorchain'
import { FeesWithRatesLD } from '../../utxo/types'
import { PoolFeeLD } from '../types'

const {
  pools: { outboundAssetFeeByChain$ }
} = midgardService

/**
 * Fees for pool outbound txs (swap/deposit/withdraw/earn)
 */
export const poolOutboundFee$ = (asset: Asset): PoolFeeLD => {
  // special case for RUNE - not provided in `inbound_addresses` endpoint
  if (isRuneNativeAsset(asset) || asset.synth) {
    return FP.pipe(
      THOR.fees$(),
      liveData.map((fees) => ({ amount: fees.fast.times(3), asset: AssetRuneNative }))
    )
  } else if (isCacaoAsset(asset) || asset.synth) {
    return FP.pipe(
      MAYA.fees$(),
      liveData.map((fees) => ({ amount: fees.fast.times(3), asset: AssetCacao }))
    )
  } else {
    const { chain } = asset
    return outboundAssetFeeByChain$(chain)
  }
}
/**
 * Fees for pool inbound txs (swap/deposit/withdraw/earn)
 */
export const poolInboundFee$ = (asset: Asset): PoolFeeLD => {
  switch (asset.chain) {
    case BNBChain:
      return FP.pipe(
        BNB.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case DOGEChain:
      return FP.pipe(
        DOGE.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case LTCChain:
      return FP.pipe(
        LTC.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case GAIAChain:
      return FP.pipe(
        COSMOS.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case BTCChain:
      return FP.pipe(
        BTC.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case BCHChain:
      return FP.pipe(
        BCH.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
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
    case KUJIChain:
      return FP.pipe(
        KUJI.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case DASHChain:
      return FP.pipe(
        DASH.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    default:
      return FP.pipe(
        poolOutboundFee$(asset),
        // inbound fees = outbound fees / 3
        liveData.map(({ asset, amount }) => ({ asset, amount: amount.div(3) }))
      )
  }
}

export const utxoFeesWithRates$ = (asset: Asset): FeesWithRatesLD => {
  switch (asset.chain) {
    case BTCChain:
      return FP.pipe(
        BTC.feesWithRates$(),
        liveData.map((feesWithRates) => feesWithRates)
      )
    case BCHChain:
      return FP.pipe(
        BCH.feesWithRates$(),
        liveData.map((feesWithRates) => feesWithRates)
      )
    case DOGEChain:
      return FP.pipe(
        DOGE.feesWithRates$(),
        liveData.map((feesWithRates) => feesWithRates)
      )
    case LTCChain:
      return FP.pipe(
        LTC.feesWithRates$(),
        liveData.map((feesWithRates) => feesWithRates)
      )
    case DASHChain:
      return FP.pipe(
        DASH.feesWithRates$(),
        liveData.map((feesWithRates) => feesWithRates)
      )
    default:
      return FP.pipe(
        BTC.feesWithRates$(),
        liveData.map((feesWithRates) => feesWithRates)
      )
  }
}

export const reloadUtxoFeesWithRates$ = (asset: Asset) => {
  switch (asset.chain) {
    case BTCChain:
      return FP.pipe(BTC.reloadFeesWithRates)
    case BCHChain:
      return FP.pipe(BCH.reloadFeesWithRates)
    case DOGEChain:
      return FP.pipe(DOGE.reloadFeesWithRates)
    case LTCChain:
      return FP.pipe(LTC.reloadFeesWithRates)
    case DASHChain:
      return FP.pipe(DASH.reloadFeesWithRates)
    default:
      return FP.pipe(BTC.reloadFeesWithRates)
  }
}
