import { Network } from '@xchainjs/xchain-client'
import { type PoolDetail as PoolDetailMaya } from '@xchainjs/xchain-mayamidgard'
import { type PoolDetail } from '@xchainjs/xchain-midgard'
import {
  baseAmount,
  assetFromString,
  assetToBase,
  assetAmount,
  BaseAmount,
  bnOrZero,
  assetToString,
  baseToAsset,
  AnyAsset,
  currencySymbolByAsset
} from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'

import { PoolsWatchList } from '../../../shared/api/io'
import { ONE_RUNE_BASE_AMOUNT } from '../../../shared/mock/amount'
import { isChainAsset, isUSDAsset } from '../../helpers/assetHelper'
import { isArbChain, isAvaxChain, isBaseChain, isEthChain } from '../../helpers/chainHelper'
import { eqString, eqAsset } from '../../helpers/fp/eq'
import { ordBaseAmount } from '../../helpers/fp/ord'
import { sequenceTOption } from '../../helpers/fpHelpers'
import { LastblockItem as LastblockItemMaya } from '../../services/mayachain/types'
import { GetPoolsStatusEnum, PoolData, PoolFilter } from '../../services/midgard/midgardTypes'
import { toPoolData } from '../../services/midgard/thorMidgard/utils'
import { LastblockItem } from '../../services/thorchain/types'
import { PoolTableRowData, PoolsSort, PoolsSortKey } from './Pools.types'

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
  const R = pool.dexBalance.amount()
  const A = pool.assetBalance.amount()
  const result = t.times(R).div(A)
  return baseAmount(result)
}

export const getValueOfRuneInAsset = (inputRune: BaseAmount, pool: PoolData): BaseAmount => {
  // formula: ((r * A) / R) => A per R ($perRune)
  const r = inputRune.amount()
  const R = pool.dexBalance.amount()
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

export const getPoolTableRowDataMaya = ({
  poolDetail,
  pricePoolData,
  watchlist,
  network
}: {
  poolDetail: PoolDetailMaya
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
  asset: AnyAsset,
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
const getBlocksLeftForPendingMayaPool = (
  lastblocks: Array<Pick<LastblockItemMaya, 'chain' | 'mayachain'>>,
  asset: AnyAsset,
  oNewPoolCycle: O.Option<number>
): O.Option<number> => {
  const oLastHeight = FP.pipe(
    lastblocks,
    A.findFirst((blockInfo) => eqString.equals(blockInfo.chain, asset.chain)),
    O.map(({ mayachain }) => Number(mayachain))
  )

  return FP.pipe(
    sequenceTOption(oNewPoolCycle, oLastHeight),
    O.map(([newPoolCycle, lastHeight]) => newPoolCycle - (lastHeight % newPoolCycle))
  )
}

export const getBlocksLeftForPendingPoolAsString = (
  lastblocks: Array<Pick<LastblockItem, 'chain' | 'thorchain'>>,
  asset: AnyAsset,
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
export const getBlocksLeftForPendingPoolAsStringMaya = (
  lastblocks: Array<Pick<LastblockItemMaya, 'chain' | 'mayachain'>>,
  asset: AnyAsset,
  poolCycle: O.Option<number>
): string => {
  return FP.pipe(
    getBlocksLeftForPendingMayaPool(lastblocks, asset, poolCycle),
    O.fold(
      () => '',
      (blocksLeft) => blocksLeft.toString()
    )
  )
}

export type FilterTableData = Pick<PoolTableRowData, 'asset' | 'watched'>
/**
 * Filters tableData array by passed active filter.
 * If oFilter is O.none will return tableData array without any changes.
 * Generic over any row exposing `asset` + `watched` so it can filter
 * THORChain/MAYAChain pool rows as well as Chainflip asset rows.
 */
export const filterTableData =
  (oFilter: O.Option<PoolFilter> = O.none) =>
  <T extends FilterTableData>(tableData: T[]): T[] => {
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
            // all native chain assets
            if (value === '__native__') {
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
            // avax
            if (value === '__avax__') {
              return isAvaxChain(asset.chain) ? O.some(tableRow) : O.none
            }
            // base
            if (value === '__base__') {
              return isBaseChain(asset.chain) ? O.some(tableRow) : O.none
            }
            // arb
            if (value === '__arb__') {
              return isArbChain(asset.chain) ? O.some(tableRow) : O.none
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

export const isEmptyPool = ({
  assetDepth,
  runeDepth
}: Pick<PoolDetail | PoolDetailMaya, 'assetDepth' | 'runeDepth'>): boolean =>
  bnOrZero(assetDepth).isZero() || bnOrZero(runeDepth).isZero()

const COMPACT_UNITS: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K']
]

/**
 * Adds the currency of `asset` to a formatted value:
 * single character symbols (`$`, `ᚱ`, `₿`, `Ξ`) as prefix, tickers (`CACAO`) as suffix
 */
const withCurrency = (value: string, asset: AnyAsset): string => {
  const symbol = currencySymbolByAsset(asset)
  return [...symbol].length === 1 ? `${symbol}${value}` : `${value} ${symbol}`
}

/**
 * Formats a number abbreviated with 2 decimals, e.g. `27.61M`, `961.65K`, `12.30`
 */
export const formatCompactNumber = (value: number): string => {
  const abs = Math.abs(value)
  const unit = COMPACT_UNITS.find(([size]) => abs >= size)
  if (unit) return `${(value / unit[0]).toFixed(2)}${unit[1]}`
  return value.toFixed(2)
}

/**
 * Formats an amount abbreviated with currency of `asset`, e.g. `$27.61M`, `1.20K CACAO`
 */
export const formatCompactAmount = (amount: BaseAmount, asset: AnyAsset): string =>
  withCurrency(formatCompactNumber(baseToAsset(amount).amount().toNumber()), asset)

/**
 * Formats a price with currency of `asset`.
 * Decimals depend on the size of the price: `$75,193.82`, `$241.091`, `$0.9404`, `$0.0003321`
 */
export const formatPoolPrice = (amount: BaseAmount, asset: AnyAsset): string => {
  const value = baseToAsset(amount).amount().toNumber()
  const abs = Math.abs(value)
  const format = (options: Intl.NumberFormatOptions) => value.toLocaleString('en-US', options)
  const formatted =
    abs === 0
      ? '0'
      : abs >= 1000
        ? format({ minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : abs >= 1
          ? format({ minimumFractionDigits: 3, maximumFractionDigits: 3 })
          : abs >= 0.01
            ? format({ minimumFractionDigits: 4, maximumFractionDigits: 4 })
            : format({ maximumSignificantDigits: 4 })
  return withCurrency(formatted, asset)
}

/**
 * Formats an APY (in percent) with 2 decimals, e.g. `5.28%`
 */
export const formatPoolApy = (apy: number): string => `${apy.toFixed(2)}%`

const comparePoolRows =
  (key: PoolsSortKey) =>
  (a: PoolTableRowData, b: PoolTableRowData): number => {
    switch (key) {
      case 'asset':
        return a.asset.ticker.localeCompare(b.asset.ticker) || a.asset.chain.localeCompare(b.asset.chain)
      case 'poolPrice':
        return ordBaseAmount.compare(a.poolPrice, b.poolPrice)
      case 'depthPrice':
        return ordBaseAmount.compare(a.depthPrice, b.depthPrice)
      case 'volumePrice':
        return ordBaseAmount.compare(a.volumePrice, b.volumePrice)
      case 'apy':
        return a.apy - b.apy
    }
  }

/**
 * Sorts rows of a pools table by given key and direction.
 * Equal rows keep their order (stable sort).
 */
export const sortPoolRows = <T extends PoolTableRowData>(rows: T[], { key, direction }: PoolsSort): T[] => {
  const compare = comparePoolRows(key)
  return [...rows].sort((a, b) => (direction === 'desc' ? compare(b, a) : compare(a, b)))
}
