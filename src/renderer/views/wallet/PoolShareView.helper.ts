import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount, Chain } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'

import { PoolShareTableData } from '../../components/PoolShares/PoolShares.types'
import { ZERO_BASE_AMOUNT } from '../../const'
import { THORCHAIN_DECIMAL, to1e8BaseAmount } from '../../helpers/assetHelper'
import { isPoolDetails } from '../../helpers/poolHelper'
import * as ShareHelpers from '../../helpers/poolShareHelper'
import { PoolDetails as PoolDetailsMaya } from '../../services/midgard/mayaMidgard/types'
import {
  getPoolDetail as getPoolDetailMaya,
  toPoolData as toPoolDataMaya
} from '../../services/midgard/mayaMidgard/utils'
import { PoolData, PoolDetails, PoolShares } from '../../services/midgard/midgardTypes'
import { getPoolDetail, toPoolData } from '../../services/midgard/thorMidgard/utils'
import { getValueOfAsset1InAsset2, getValueOfRuneInAsset } from '../pools/Pools.utils'

export const getSharesTotal = (
  shares: PoolShares,
  poolDetails: PoolDetails | PoolDetailsMaya,
  pricePoolData: PoolData,
  protocol: Chain
): BaseAmount =>
  FP.pipe(
    shares,
    A.filterMap(({ units, asset }) =>
      FP.pipe(
        isPoolDetails(poolDetails) ? getPoolDetail(poolDetails, asset) : getPoolDetailMaya(poolDetails, asset),
        O.map((poolDetail) => {
          // 1. get shares
          // runeDepth is in 1e8 for both THORChain and MAYAChain midgard APIs
          const runeShare = ShareHelpers.getRuneShare(units, poolDetail, THORCHAIN_DECIMAL)
          const assetDecimal = parseInt(poolDetail.nativeDecimal || '8', 10) || 8
          // THORChain assetDepth is always in 1e8; MAYAChain assetDepth is in native decimal
          const assetDexDecimal = protocol === THORChain ? THORCHAIN_DECIMAL : assetDecimal
          const assetShare = ShareHelpers.getAssetShare({
            liquidityUnits: units,
            detail: poolDetail,
            assetDecimal,
            dexDecimal: assetDexDecimal
          })
          const poolData = protocol === THORChain ? toPoolData(poolDetail) : toPoolDataMaya(poolDetail)
          // 2. price asset + rune
          // Pool balances are normalized to 1e10 (MAYAChain) or 1e8 (THORChain);
          // getValueOfAsset1InAsset2 expects input in 1e8
          const assetShareForPricing = to1e8BaseAmount(assetShare)
          const assetDepositPrice = getValueOfAsset1InAsset2(assetShareForPricing, poolData, pricePoolData)
          const runeDepositPrice = getValueOfRuneInAsset(runeShare, pricePoolData)

          // 3. sum rune + asset values
          return runeDepositPrice.plus(assetDepositPrice)
        })
      )
    ),
    // sum all share values
    A.reduce(ZERO_BASE_AMOUNT, (acc, curr) => acc.plus(curr))
  )

export const getPoolShareTableData = (
  shares: PoolShares,
  poolDetails: PoolDetails | PoolDetailsMaya,
  pricePoolData: PoolData,
  protocol: Chain
): PoolShareTableData =>
  FP.pipe(
    shares,
    A.filterMap(({ units, asset, type }) =>
      FP.pipe(
        isPoolDetails(poolDetails) ? getPoolDetail(poolDetails, asset) : getPoolDetailMaya(poolDetails, asset),
        O.map((poolDetail) => {
          // runeDepth is in 1e8 for both THORChain and MAYAChain midgard APIs
          const runeShare = ShareHelpers.getRuneShare(units, poolDetail, THORCHAIN_DECIMAL)
          const assetDecimal = parseInt(poolDetail.nativeDecimal || '8', 10) || 8
          // THORChain assetDepth is always in 1e8; MAYAChain assetDepth is in native decimal
          const assetDexDecimal = protocol === THORChain ? THORCHAIN_DECIMAL : assetDecimal
          const assetShare = ShareHelpers.getAssetShare({
            liquidityUnits: units,
            detail: poolDetail,
            assetDecimal,
            dexDecimal: assetDexDecimal
          })
          const sharePercent = ShareHelpers.getPoolShare(units, poolDetail)
          const poolData = protocol === THORChain ? toPoolData(poolDetail) : toPoolDataMaya(poolDetail)
          // Pool balances are normalized to 1e10 (MAYAChain) or 1e8 (THORChain);
          // getValueOfAsset1InAsset2 expects input in 1e8
          const assetShareForPricing = to1e8BaseAmount(assetShare)
          const assetDepositPrice = getValueOfAsset1InAsset2(assetShareForPricing, poolData, pricePoolData)
          const runeDepositPrice = getValueOfRuneInAsset(runeShare, pricePoolData)

          return {
            asset,
            runeShare,
            assetShare,
            sharePercent,
            assetDepositPrice,
            runeDepositPrice,
            type
          }
        })
      )
    )
  )
