import { Network } from '@xchainjs/xchain-client'
import { PoolDetail as PoolDetailMaya } from '@xchainjs/xchain-mayamidgard'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { assetFromString, BaseAmount, baseAmount, bnOrZero } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Ord from 'fp-ts/lib/Ord'

import { PoolsWatchList } from '../../shared/api/io'
import type { PoolDetails as PoolDetailsMaya } from '../services/mayaMigard/types'
import type { PoolDetails } from '../services/midgard/types'
import { toPoolData } from '../services/midgard/utils'
import { LoansTableRowData, LoansTableRowsData } from '../views/loans/Loans.types'
import { PoolData } from '../views/pools/Pools.types'
import { getValueOfAsset1InAsset2 } from '../views/pools/Pools.utils'
import { eqAsset, eqString } from './fp/eq'
import { ordBaseAmount } from './fp/ord'
import { sequenceTOption, sequenceTOptionFromArray } from './fpHelpers'
import { getDeepestPoolSymbol, isPoolDetails } from './poolHelper'
import { getDeepestPoolSymbol as getDeepestPoolSymbolMaya } from './poolHelperMaya'

/**
 * Order lending by collaterla price
 */
export const ordCollateralByDepth = Ord.Contravariant.contramap(
  ordBaseAmount,
  ({ collateralPrice }: { collateralPrice: BaseAmount }) => collateralPrice
)

export const getLoansTableRowData = ({
  poolDetail,
  pricePoolData,
  watchlist,
  network
}: {
  poolDetail: PoolDetail | PoolDetailMaya
  pricePoolData: PoolData
  watchlist: PoolsWatchList
  network: Network
}): O.Option<LoansTableRowData> => {
  return FP.pipe(
    poolDetail.asset,
    assetFromString,
    O.fromNullable,
    O.map((poolDetailAsset) => {
      const poolData = toPoolData(poolDetail)
      const collateral = baseAmount(poolDetail.totalCollateral)
      const collateralPrice = getValueOfAsset1InAsset2(collateral, poolData, pricePoolData)
      const debt = baseAmount(poolDetail.totalDebtTor)

      const filled = bnOrZero(poolDetail.totalCollateral).times(100).div(0)
      // current supply -> 500 mil - circ supply * 33%
      // add pool depths btc & eth / btc depth in rune
      const watched: boolean = FP.pipe(
        watchlist,
        A.findFirst((poolInList) => eqAsset.equals(poolInList, poolDetailAsset)),
        O.isSome
      )

      return {
        asset: poolDetailAsset,
        collateral,
        collateralPrice,
        filled,
        key: poolDetailAsset.ticker,
        network,
        debt,
        watched
      }
    })
  )
}

export const getLoansTableRowsData = ({
  poolDetails,
  pricePoolData,
  watchlist,
  network
}: {
  poolDetails: PoolDetails | PoolDetailsMaya
  pricePoolData: PoolData
  watchlist: PoolsWatchList
  network: Network
}): LoansTableRowsData => {
  // get symbol of deepest pool
  const oDeepestPoolSymbol: O.Option<string> = isPoolDetails(poolDetails)
    ? getDeepestPoolSymbol(poolDetails)
    : getDeepestPoolSymbolMaya(poolDetails)

  // Transform `PoolDetails` -> SaversTableRowData
  return FP.pipe(
    poolDetails,
    A.mapWithIndex<PoolDetail | PoolDetailMaya, O.Option<LoansTableRowData>>((index, poolDetail) => {
      // get symbol of PoolDetail
      const oPoolDetailSymbol: O.Option<string> = FP.pipe(
        O.fromNullable(assetFromString(poolDetail.asset ?? '')),
        O.map(({ symbol }) => symbol)
      )
      // compare symbols to set deepest pool
      const deepest = FP.pipe(
        sequenceTOption(oDeepestPoolSymbol, oPoolDetailSymbol),
        O.fold(
          () => false,
          ([deepestPoolSymbol, poolDetailSymbol]) => eqString.equals(deepestPoolSymbol, poolDetailSymbol)
        )
      )

      return FP.pipe(
        getLoansTableRowData({ poolDetail, pricePoolData, watchlist, network }),
        O.map(
          (poolTableRowData) =>
            ({
              ...poolTableRowData,
              key: poolDetail?.asset || index.toString(),
              deepest
            } as LoansTableRowData)
        )
      )
    }),
    sequenceTOptionFromArray,
    O.getOrElse(() => [] as LoansTableRowsData),
    // Table does not accept `defaultSortOrder` for depth  for any reason,
    // that's why we sort depth here
    A.sortBy([ordCollateralByDepth]),
    // descending sort
    A.reverse
  )
}
