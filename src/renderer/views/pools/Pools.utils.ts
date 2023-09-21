import {
  baseAmount,
  assetFromString,
  Asset,
  assetToBase,
  assetAmount,
  BaseAmount,
  bnOrZero,
  assetToString,
  baseToAsset
} from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { PoolsWatchList } from '../../../shared/api/io'
import { Network } from '../../../shared/api/types'
import { ONE_RUNE_BASE_AMOUNT } from '../../../shared/mock/amount'
import { isBtcAsset, isChainAsset, isEthAsset, isUSDAsset, isEthTokenAsset } from '../../helpers/assetHelper'
import { isBnbChain, isEthChain } from '../../helpers/chainHelper'
import { eqString, eqAsset } from '../../helpers/fp/eq'
import { sequenceTOption } from '../../helpers/fpHelpers'
import { PoolFilter } from '../../services/midgard/types'
import { toPoolData } from '../../services/midgard/utils'
import { LastblockItem } from '../../services/thorchain/types'
import { GetPoolsStatusEnum, type PoolDetail } from '../../types/generated/midgard'
import { PoolData, PoolTableRowData } from './Pools.types'

export const stringToGetPoolsStatus = (status: string): GetPoolsStatusEnum => {
  switch (status) {
    case GetPoolsStatusEnum.Suspended: {
      return GetPoolsStatusEnum.Suspended
    }
    case GetPoolsStatusEnum.Available:
      return GetPoolsStatusEnum.Available
    case GetPoolsStatusEnum.Staged:
      return GetPoolsStatusEnum.Staged
    default:
      return GetPoolsStatusEnum.Suspended
  }
}

export const getValueOfAssetInRune = (inputAsset: BaseAmount, pool: PoolData): BaseAmount => {
  // formula: ((a * R) / A) => R per A (Runeper$)
  const t = inputAsset.amount()
  const R = pool.runeBalance.amount()
  const A = pool.assetBalance.amount()
  const result = t.times(R).div(A)
  return baseAmount(result)
}

export const getValueOfRuneInAsset = (inputRune: BaseAmount, pool: PoolData): BaseAmount => {
  // formula: ((r * A) / R) => A per R ($perRune)
  const r = inputRune.amount()
  const R = pool.runeBalance.amount()
  const A = pool.assetBalance.amount()
  const result = r.times(A).div(R)
  return baseAmount(result)
}

export const getValueOfAsset1InAsset2 = (inputAsset: BaseAmount, pool1: PoolData, pool2: PoolData): BaseAmount => {
  // formula: (A2 / R) * (R / A1) => A2/A1 => A2 per A1 ($ per Asset)
  const oneAsset = assetToBase(assetAmount(1))
  // Note: All calculation needs to be done in `AssetAmount` (not `BaseAmount`)
  const A2perR = baseToAsset(getValueOfRuneInAsset(oneAsset, pool2))
  const RperA1 = baseToAsset(getValueOfAssetInRune(inputAsset, pool1))
  const result = A2perR.amount().times(RperA1.amount())
  // transform result back from `AssetAmount` into `BaseAmount`
  return assetToBase(assetAmount(result))
}

export const getPoolTableRowData = ({
  poolDetail,
  pricePoolData,
  watchlist,
  network
}: {
  poolDetail: PoolDetail
  pricePoolData: PoolData
  watchlist: PoolsWatchList
  network: Network
}): O.Option<PoolTableRowData> => {
  return FP.pipe(
    poolDetail.asset,
    assetFromString,
    O.fromNullable,
    O.map((poolDetailAsset) => {
      const poolData = toPoolData(poolDetail)
      // convert string -> BN -> number - just for convenience
      const apy = bnOrZero(poolDetail.poolAPY).multipliedBy(100).decimalPlaces(2).toNumber()

      const poolPrice = getValueOfAsset1InAsset2(ONE_RUNE_BASE_AMOUNT, poolData, pricePoolData)

      // `depthAmount` is one side only, but we do need to show depth of both sides (asset + rune depth)
      const depthAmountInRune = baseAmount(poolDetail.runeDepth).times(2)
      const depthPrice = getValueOfRuneInAsset(depthAmountInRune, pricePoolData)
      const depthAmountInAsset = getValueOfRuneInAsset(depthAmountInRune, poolData)

      const volumeAmount = baseAmount(poolDetail.volume24h)
      const volumePrice = getValueOfRuneInAsset(volumeAmount, pricePoolData)
      const volumeAmountInAsset = getValueOfRuneInAsset(volumeAmount, poolData)

      const status = stringToGetPoolsStatus(poolDetail.status)

      const watched: boolean = FP.pipe(
        watchlist,
        A.findFirst((poolInList) => eqAsset.equals(poolInList, poolDetailAsset)),
        O.isSome
      )

      return {
        asset: poolDetailAsset,
        poolPrice,
        depthAmount: depthAmountInAsset,
        depthPrice,
        volumePrice,
        volumeAmount: volumeAmountInAsset,
        status,
        key: poolDetailAsset.ticker,
        network,
        apy,
        watched
      }
    })
  )
}

export const getBlocksLeftForPendingPool = (
  lastblocks: Array<Pick<LastblockItem, 'chain' | 'thorchain'>>,
  asset: Asset,
  oNewPoolCycle: O.Option<number>
): O.Option<number> => {
  const oLastHeight = FP.pipe(
    lastblocks,
    A.findFirst((blockInfo) => eqString.equals(blockInfo.chain, asset.chain)),
    O.map(({ thorchain }) => Number(thorchain))
  )

  return FP.pipe(
    sequenceTOption(oNewPoolCycle, oLastHeight),
    O.map(([newPoolCycle, lastHeight]) => newPoolCycle - (lastHeight % newPoolCycle))
  )
}

export const getBlocksLeftForPendingPoolAsString = (
  lastblocks: Array<Pick<LastblockItem, 'chain' | 'thorchain'>>,
  asset: Asset,
  poolCycle: O.Option<number>
): string => {
  return FP.pipe(
    getBlocksLeftForPendingPool(lastblocks, asset, poolCycle),
    O.fold(
      () => '',
      (blocksLeft) => blocksLeft.toString()
    )
  )
}

export type FilterTableData = Pick<PoolTableRowData, 'asset' | 'watched'>
/**
 * Filters tableData array by passed active filter.
 * If oFilter is O.none will return tableData array without any changes
 */
export const filterTableData =
  (oFilter: O.Option<PoolFilter> = O.none) =>
  (tableData: FilterTableData[]): FilterTableData[] => {
    return FP.pipe(
      oFilter,
      O.map((filter) =>
        FP.pipe(
          tableData,
          A.filterMap((tableRow) => {
            const asset = tableRow.asset
            const value = filter.toLowerCase()
            // watched assets
            if (value === '__watched__') {
              return tableRow.watched ? O.some(tableRow) : O.none
            }
            // all base chain assets
            if (value === '__base__') {
              return isChainAsset(asset) ? O.some(tableRow) : O.none
            }
            // usd assets
            if (value === '__usd__') {
              return isUSDAsset(asset) ? O.some(tableRow) : O.none
            }
            // erc20
            if (value === '__erc20__') {
              return isEthChain(asset.chain) && !isChainAsset(asset) ? O.some(tableRow) : O.none
            }
            // bep2
            if (value === '__bep2__') {
              return isBnbChain(asset.chain) && !isChainAsset(asset) ? O.some(tableRow) : O.none
            }
            // custom
            if (value.length > 0) {
              return assetToString(asset).toLowerCase().includes(value) ? O.some(tableRow) : O.none
            }

            return O.none
          })
        )
      ),
      O.getOrElse(() => tableData)
    )
  }

/**
 * Helper to get min. amount for pool txs
 * We use these currently to make sure all fees are covered
 *
 * TODO (@asgdx-team) Remove min. amount if xchain-* gets fee rates from THORChain
 * @see: https://github.com/xchainjs/xchainjs-lib/issues/299
 */
export const minPoolTxAmountUSD = (asset: Asset): BaseAmount => {
  // BUSD has 8 decimal
  const value = (v: number) => assetToBase(assetAmount(v, 8))
  // BTC $200
  if (isBtcAsset(asset)) return value(200)
  // ETH $50
  else if (isEthAsset(asset)) return value(50)
  // ERC20 $100
  else if (isEthTokenAsset(asset)) return value(100)
  // anything else $10
  else return value(10)
}

export const isEmptyPool = ({ assetDepth, runeDepth }: Pick<PoolDetail, 'assetDepth' | 'runeDepth'>): boolean =>
  bnOrZero(assetDepth).isZero() || bnOrZero(runeDepth).isZero()
