import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { Dex } from '../../../shared/api/types'
import { PoolShareTableData } from '../../components/PoolShares/PoolShares.types'
import { ZERO_BASE_AMOUNT } from '../../const'
import { isPoolDetails } from '../../helpers/poolHelper'
import * as ShareHelpers from '../../helpers/poolShareHelper'
import { PoolDetails as PoolDetailsMaya, PoolShares as PoolSharesMaya } from '../../services/mayaMigard/types'
import { getPoolDetail as getPoolDetailMaya, toPoolData as toPoolDataMaya } from '../../services/mayaMigard/utils'
import { PoolDetails, PoolShares } from '../../services/midgard/types'
import { getPoolDetail, toPoolData } from '../../services/midgard/utils'
import { PoolData } from '../pools/Pools.types'
import { getValueOfAsset1InAsset2, getValueOfRuneInAsset } from '../pools/Pools.utils'

export const getSharesTotal = (
  shares: PoolShares | PoolSharesMaya,
  poolDetails: PoolDetails | PoolDetailsMaya,
  pricePoolData: PoolData,
  dex: Dex
): BaseAmount =>
  FP.pipe(
    shares,
    A.filterMap(({ units, asset }) =>
      FP.pipe(
        isPoolDetails(poolDetails) ? getPoolDetail(poolDetails, asset) : getPoolDetailMaya(poolDetails, asset),
        O.map((poolDetail) => {
          // 1. get shares
          const runeShare = ShareHelpers.getRuneShare(units, poolDetail, dex)
          const assetShare = ShareHelpers.getAssetShare({
            liquidityUnits: units,
            detail: poolDetail,
            assetDecimal: 8
          })
          const poolData = dex.chain === THORChain ? toPoolData(poolDetail) : toPoolDataMaya(poolDetail)
          // 2. price asset + rune
          const assetDepositPrice = getValueOfAsset1InAsset2(assetShare, poolData, pricePoolData)
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
  shares: PoolShares | PoolSharesMaya,
  poolDetails: PoolDetails | PoolDetailsMaya,
  pricePoolData: PoolData,
  dex: Dex
): PoolShareTableData =>
  FP.pipe(
    shares,
    A.filterMap(({ units, asset, type }) =>
      FP.pipe(
        isPoolDetails(poolDetails) ? getPoolDetail(poolDetails, asset) : getPoolDetailMaya(poolDetails, asset),
        O.map((poolDetail) => {
          const runeShare = ShareHelpers.getRuneShare(units, poolDetail, dex)
          // FIXME: (@Veado) Fix decimal
          // https://github.com/thorchain/asgardex-electron/issues/1163
          const assetShare = ShareHelpers.getAssetShare({
            liquidityUnits: units,
            detail: poolDetail,
            assetDecimal: 8 /* FIXME: see previous comment ^ */
          })
          const sharePercent = ShareHelpers.getPoolShare(units, poolDetail)
          const poolData = dex.chain === THORChain ? toPoolData(poolDetail) : toPoolDataMaya(poolDetail)
          const assetDepositPrice = getValueOfAsset1InAsset2(assetShare, poolData, pricePoolData)
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
