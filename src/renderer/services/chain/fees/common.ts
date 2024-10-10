import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, Asset, AssetType } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { isChainOfThor } from '../../../../shared/utils/chain'
import { isCacaoAsset, isRuneNativeAsset } from '../../../helpers/assetHelper'
import { liveData } from '../../../helpers/rx/liveData'
import * as BTC from '../../bitcoin'
import * as BCH from '../../bitcoincash'
import * as COSMOS from '../../cosmos'
import * as DASH from '../../dash'
import * as DOGE from '../../doge'
import * as KUJI from '../../kuji'
import * as LTC from '../../litecoin'
import * as MAYA from '../../mayachain'
import { service as midgardMayaService } from '../../mayaMigard/service'
import { service as midgardService } from '../../midgard/service'
import * as XRD from '../../radix'
import * as THOR from '../../thorchain'
import { FeesWithRatesLD } from '../../utxo/types'
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
  if (isRuneNativeAsset(asset) || asset.type === AssetType.SYNTH || asset.type === AssetType.TRADE) {
    return FP.pipe(
      THOR.fees$(),
      liveData.map((fees) => ({ amount: fees.fast.times(3), asset: AssetRuneNative }))
    )
  } else if (isCacaoAsset(asset)) {
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
  switch (asset.chain) {
    case DOGEChain:
      return FP.pipe(
        DOGE.feesWithRates$(memo),
        liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
      )
    case LTCChain:
      return FP.pipe(
        LTC.feesWithRates$(memo),
        liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
      )
    case GAIAChain:
      return FP.pipe(
        COSMOS.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case BTCChain:
      return FP.pipe(
        BTC.feesWithRates$(memo),
        liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
      )
    case BCHChain:
      return FP.pipe(
        BCH.feesWithRates$(memo),
        liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
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
    case RadixChain:
      return FP.pipe(
        XRD.fees$(),
        liveData.map((fees) => ({ asset, amount: fees.fast }))
      )
    case DASHChain:
      return FP.pipe(
        DASH.feesWithRates$(memo),
        liveData.map((fees) => ({ asset, amount: fees.fees.fast }))
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
