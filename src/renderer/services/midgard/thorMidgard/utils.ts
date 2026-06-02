import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AssetAVAX, AVAX_GAS_ASSET_DECIMAL, AVAXChain } from '@xchainjs/xchain-avax'
import { AssetBETH, BASE_GAS_ASSET_DECIMAL, BASEChain } from '@xchainjs/xchain-base'
import { BTC_DECIMAL, BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCH_DECIMAL, BCHChain } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC, BSC_GAS_ASSET_DECIMAL, BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { COSMOS_DECIMAL, GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGE_DECIMAL, DOGEChain } from '@xchainjs/xchain-doge'
import { ETH_GAS_ASSET_DECIMAL, ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTC_DECIMAL, LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { RadixChain } from '@xchainjs/xchain-radix'
import { AssetXRP, XRP_DECIMAL, XRPChain } from '@xchainjs/xchain-ripple'
import { SOL_DECIMALS, SOLAsset, SOLChain } from '@xchainjs/xchain-solana'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { TRONChain, TRX_DECIMAL } from '@xchainjs/xchain-tron'
import {
  assetFromString,
  bnOrZero,
  baseAmount,
  Asset,
  assetToString,
  isValidBN,
  bn,
  BaseAmount,
  Address,
  AnyAsset,
  Chain
} from '@xchainjs/xchain-util'
import { ZEC_DECIMAL, ZECChain } from '@xchainjs/xchain-zcash'
import { array as A, function as FP, nonEmptyArray as NEA, option as O, predicate as P } from 'fp-ts'

import {
  AssetATOM,
  AssetBCH,
  AssetBTC,
  AssetDOGE,
  AssetETH,
  AssetLTC,
  AssetTRX,
  AssetZEC
} from '../../../../shared/utils/asset'
import { isSupportedChain } from '../../../../shared/utils/chain'
import { optionFromNullableString } from '../../../../shared/utils/fp'
import { convertBaseAmountDecimal, isUSDAsset, THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { eqAsset, eqChain, eqOAddress } from '../../../helpers/fp/eq'
import { ordPricePool } from '../../../helpers/fp/ord'
import { getDeepestPool, RUNE_POOL_ADDRESS, RUNE_PRICE_POOL } from '../../../helpers/poolHelper'
import { AssetWithAmount } from '../../../types/asgardex'
import { PricePoolAssets, PricePoolAsset } from '../../../views/pools/Pools.types'
import { InboundAddress } from '../../thorchain/types'
import {
  PoolAssetDetails as PoolAssetsDetail,
  PoolDetails,
  PoolsStateRD,
  SelectedPricePoolAsset,
  PoolAssetDetail,
  PoolShares,
  PoolShare,
  PoolAddress,
  PoolAddresses,
  PoolsDataMap,
  GetPoolsPeriodEnum,
  GetPoolPeriodEnum,
  PricePools,
  PricePool,
  PoolData
} from '../midgardTypes'

export const getPricePools = (details: PoolDetails, whitelist: PricePoolAssets): PricePools => {
  const oUSDPricePool: O.Option<PricePool> = FP.pipe(
    whitelist,
    A.filter(isUSDAsset),
    (usdAssets) =>
      details.filter((detail) =>
        usdAssets.find((asset) => detail.asset.toLowerCase() === assetToString(asset).toLowerCase())
      ),
    getDeepestPool,
    O.chain((detail) =>
      FP.pipe(
        assetFromString(detail.asset),
        O.fromNullable,
        O.map((asset) => ({
          asset,
          poolData: toPoolData(detail)
        }))
      )
    )
  )

  const pricePoolAssets: PricePoolAssets = FP.pipe(whitelist, A.filter(P.not(isUSDAsset)))

  return FP.pipe(
    details,
    // filter details for using assets in whitelist only
    A.filterMap((detail) => {
      const asset = pricePoolAssets.find((asset) => detail.asset === assetToString(asset))
      return asset ? O.some(detail) : O.none
    }),
    // Map `PoolDetail` -> `PricePool`
    A.filterMap(
      (detail: PoolDetail): O.Option<PricePool> =>
        FP.pipe(
          assetFromString(detail.asset),
          O.fromNullable,
          O.map((asset) => ({
            asset,
            poolData: toPoolData(detail)
          }))
        )
    ),
    // Add USD price pool (if available)
    (pricePools) =>
      FP.pipe(
        oUSDPricePool,
        O.map((usdPricePool) => [...pricePools, usdPricePool]),
        O.getOrElse(() => pricePools)
      ),
    // Add RUNE price pool
    A.append(RUNE_PRICE_POOL),
    // sort by weights
    NEA.sort(ordPricePool),
    // reverse to start with hihger weight
    NEA.reverse
  )
}

/**
 * Selector to get a `PricePool` from a list of `PricePools` by a given `PricePoolAsset`
 *
 * It will always return a `PricePool`:
 * - (1) `PricePool` from list of pools (if available)
 * - (2) OR BUSDB (if available in list of pools)
 * - (3) OR RUNE (if no other pool is available)
 */
export const pricePoolSelector = (pools: PricePools, oAsset: O.Option<PricePoolAsset>): PricePool =>
  FP.pipe(
    oAsset,
    // (1) Check if `PricePool` is available in `PricePools`
    O.chainNullableK((asset) => pools.find((pool) => eqAsset.equals(pool.asset, asset))),
    // (2) If (1) fails, check if USD pool is available in `PricePools`
    O.fold(() => O.fromNullable(pools.find((pool) => isUSDAsset(pool.asset))), O.some),
    // (3) If (2) fails, return RUNE pool, which is always first entry in pools list
    O.getOrElse(() => NEA.head(pools))
  )

/**
 * Similar to `pricePoolSelector`, but taking `PoolsStateRD` instead of `PoolsState`
 */
export const pricePoolSelectorFromRD = (
  poolsRD: PoolsStateRD,
  selectedPricePoolAsset: SelectedPricePoolAsset
): PricePool =>
  FP.pipe(
    RD.toOption(poolsRD),
    O.chain((pools) => pools.pricePools),
    O.map((pricePools) => pricePoolSelector(pricePools, selectedPricePoolAsset)),
    O.getOrElse(() => RUNE_PRICE_POOL)
  )

/**
 * Creates a normalized key for asset lookups (case-insensitive)
 */
const createAssetKey = (chain: string, symbol: string, ticker: string): string =>
  `${chain.toUpperCase()}:${symbol.toUpperCase()}:${ticker.toUpperCase()}`

/**
 * Creates a Map from PoolDetails for O(1) lookups
 * Use this when performing multiple lookups on the same details array
 */
export const createPoolDetailsMap = (details: PoolDetails): Map<string, PoolDetail> => {
  const map = new Map<string, PoolDetail>()

  for (const detail of details) {
    const parsed = assetFromString(detail.asset)
    if (parsed) {
      const key = createAssetKey(parsed.chain, parsed.symbol, parsed.ticker)
      map.set(key, detail)
    }
  }

  return map
}

/**
 * Gets a `PoolDetail` by given Asset from a pre-built Map (O(1) lookup)
 */
export const getPoolDetailFromMap = (detailsMap: Map<string, PoolDetail>, asset: AnyAsset): O.Option<PoolDetail> => {
  const key = createAssetKey(asset.chain, asset.symbol, asset.ticker)
  return O.fromNullable(detailsMap.get(key))
}

/**
 * Gets a `PoolDetail by given Asset
 * It returns `None` if no `PoolDetail` has been found
 * Adjusted to handle synth assets
 *
 * Note: For repeated lookups on the same details array, use createPoolDetailsMap + getPoolDetailFromMap for O(1) performance
 */
export const getPoolDetail = (details: PoolDetails, asset: AnyAsset): O.Option<PoolDetail> => {
  const key = createAssetKey(asset.chain, asset.symbol, asset.ticker)

  for (const detail of details) {
    const parsed = assetFromString(detail.asset)
    if (parsed) {
      const detailKey = createAssetKey(parsed.chain, parsed.symbol, parsed.ticker)
      if (detailKey === key) {
        return O.some(detail)
      }
    }
  }

  return O.none
}

/**
 * Converts `PoolDetails` to `PoolsDataMap`
 * Keys of the end HasMap is PoolDetails[i].asset
 */
export const toPoolsData = (poolDetails: Array<Pick<PoolDetail, 'asset' | 'assetDepth' | 'runeDepth'>>): PoolsDataMap =>
  poolDetails.reduce<PoolsDataMap>((acc, cur) => ({ ...acc, [cur.asset]: toPoolData(cur) }), {})

/**
 * Converts a `BaseAmount` string into `PoolData` balance (always `1e8` decimal based)
 */
export const toPoolBalance = (baseAmountString: string): BaseAmount => baseAmount(baseAmountString, THORCHAIN_DECIMAL)

/**
 * Transforms `PoolDetail` into `PoolData` (provided by `asgardex-util`)
 *
 * Note: Balances of `PoolData` are always `1e8` based
 */
export const toPoolData = ({ assetDepth, runeDepth }: Pick<PoolDetail, 'assetDepth' | 'runeDepth'>): PoolData => ({
  assetBalance: toPoolBalance(assetDepth),
  dexBalance: toPoolBalance(runeDepth)
})

/**
 * Filter out mini tokens from pool assets
 */
export const filterPoolAssets = (poolAssets: string[]) => {
  return poolAssets.filter((poolAsset) => assetFromString(poolAsset) || { symbol: '' })
}

export const getPoolAddressesByChain = (addresses: PoolAddresses, chain: Chain): O.Option<PoolAddress> =>
  FP.pipe(
    addresses,
    A.findFirst((address) => eqChain.equals(address.chain, chain))
  )

/**
 * Helper to get outbound fees by given `outbound_fee` and `chain`
 *
 * Note: It includes fees for asset side only (not for RUNE side).
 */
export const getOutboundAssetFeeByChain = (
  addresses: Pick<InboundAddress, 'chain' | 'outbound_fee'>[],
  chain: Chain
): O.Option<AssetWithAmount> =>
  FP.pipe(
    addresses,
    A.findFirst((address) => eqChain.equals(address.chain, chain)),
    // extract outbound fee
    O.map(({ outbound_fee }) => outbound_fee),
    // Ignore undefined values
    O.chain(O.fromNullable),
    O.chain((v) => {
      try {
        return O.some(bn(v))
      } catch {
        return O.none
      }
    }),
    // Valid BigNumbers only
    O.chain(O.fromPredicate(isValidBN)),
    // Convert fee values to `BaseAmount` to put into `AssetWithAmount`
    O.chain((value) => {
      if (!isSupportedChain(chain)) return O.none

      switch (chain) {
        case BTCChain:
          return O.some({
            amount: baseAmount(value, BTC_DECIMAL),
            asset: AssetBTC
          })
        case BCHChain:
          return O.some({
            amount: baseAmount(value, BCH_DECIMAL),
            asset: AssetBCH
          })
        case LTCChain:
          return O.some({
            amount: baseAmount(value, LTC_DECIMAL),
            asset: AssetLTC
          })
        case DOGEChain:
          return O.some({
            amount: baseAmount(value, DOGE_DECIMAL),
            asset: AssetDOGE
          })
        case ETHChain: {
          return O.some({
            // Conversion of decimal needed: 1e8 (by default in THORChain) -> 1e18 (ETH)
            amount: convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), ETH_GAS_ASSET_DECIMAL),
            asset: AssetETH
          })
        }
        case AVAXChain: {
          return O.some({
            // Conversion of decimal needed: 1e8 (by default in THORChain) -> 1e18 (ETH)
            amount: convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), AVAX_GAS_ASSET_DECIMAL),
            asset: AssetAVAX
          })
        }
        case BASEChain: {
          return O.some({
            // Conversion of decimal needed: 1e8 (by default in THORChain) -> 1e18 (ETH)
            amount: convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), BASE_GAS_ASSET_DECIMAL),
            asset: AssetBETH
          })
        }
        case BSCChain: {
          return O.some({
            // Conversion of decimal needed: 1e8 (by default in THORChain) -> 1e18 (ETH)
            amount: convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), BSC_GAS_ASSET_DECIMAL),
            asset: AssetBSC
          })
        }
        case GAIAChain: {
          // Conversion of decimal needed: 1e8 (by default in THORChain) -> 1e6 (COSMOS)
          const amount = convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), COSMOS_DECIMAL)
          return O.some({
            amount,
            asset: AssetATOM
          })
        }
        case TRONChain:
          return O.some({
            amount: convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), TRX_DECIMAL),
            asset: AssetTRX
          })
        case ZECChain:
          return O.some({
            amount: baseAmount(value, ZEC_DECIMAL),
            asset: AssetZEC
          })
        case XRPChain:
          return O.some({
            amount: baseAmount(value, XRP_DECIMAL),
            asset: AssetXRP
          })
        case SOLChain:
          return O.some({
            // Conversion of decimal needed: 1e8 (by default in THORChain) -> 1e9 (SOL)
            amount: convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), SOL_DECIMALS),
            asset: SOLAsset
          })
        // 'THORChain can be ignored - fees for asset side only
        // Other chains can be ignored since they are for mayachain
        case THORChain:
        case DASHChain:
        case MAYAChain:
        case KUJIChain:
        case ADAChain:
        case ARBChain:
        case RadixChain:
          return O.none
        default:
          return O.none
      }
    })
  )

export const inboundToPoolAddresses = (
  addresses: Pick<
    InboundAddress,
    'chain' | 'address' | 'router' | 'halted' | 'gas_rate' | 'outbound_fee' | 'dust_threshold'
  >[]
): PoolAddresses =>
  FP.pipe(
    addresses,
    A.map(({ address, router, chain, halted, gas_rate, outbound_fee, dust_threshold }) => ({
      protocol: THORChain,
      chain,
      address,
      router: optionFromNullableString(router),
      halted,
      gasRate: gas_rate,
      outBoundFee: outbound_fee,
      dustThreshold: dust_threshold
    })),
    // Add "empty" rune "pool address" - we never had such pool, but do need it to calculate tx
    A.prepend(RUNE_POOL_ADDRESS)
  )

/**
 * Combines 'asym` + `sym` `Poolshare`'s of an `Asset` into a single `Poolshare` for this `Asset`
 *
 * @returns `PoolShares` List of combined `PoolShare` items for each `Asset`
 *
 * Uses Map for O(1) lookups instead of O(n) array search, reducing overall complexity from O(n²) to O(n)
 */
export const combineShares = (shares: PoolShares): PoolShares => {
  const shareMap = new Map<string, PoolShare>()

  for (const share of shares) {
    const key = assetToString(share.asset)
    const existing = shareMap.get(key)

    if (existing) {
      existing.units = share.units.plus(existing.units)
      existing.assetAddedAmount = baseAmount(share.assetAddedAmount.amount().plus(existing.assetAddedAmount.amount()))
      existing.type = 'all'
    } else {
      shareMap.set(key, { ...share, type: 'all' })
    }
  }

  return Array.from(shareMap.values())
}

/**
 * Combines 'asym` + `sym` `Poolshare`'s into a single `Poolshare` by given `Asset` only
 *
 * @returns `O.Option<PoolShare>`  If `Poolshare`'s for given `Asset` exists, it combinens its `PoolShare`. If not, it returns `O.none`
 */
export const combineSharesByAsset = (shares: PoolShares, asset: Asset): O.Option<PoolShare> =>
  FP.pipe(
    shares,
    // filter shares for given asset
    A.filter(({ asset: poolAsset }) => eqAsset.equals(asset, poolAsset)),
    // merge shares
    A.reduce<PoolShare, O.Option<PoolShare>>(O.none, (oAcc, cur) => {
      return FP.pipe(
        oAcc,
        O.map(
          (acc): PoolShare => ({
            ...acc,
            units: cur.units.plus(acc.units),
            assetAddedAmount: baseAmount(cur.assetAddedAmount.amount().plus(acc.assetAddedAmount.amount())),
            assetAddress: acc.assetAddress,
            runeAddress: O.isSome(acc.runeAddress) ? acc.runeAddress : cur.runeAddress,
            type: 'all'
          })
        ),
        O.getOrElse<PoolShare>(() => ({ ...cur, type: 'all' })),
        O.some
      )
    })
  )

/**
 * Filters 'asym` or `sym` `Poolshare`'s by given `Asset`
 */
export const getSharesByAssetAndType = ({
  shares,
  asset,
  type
}: {
  shares: PoolShares
  asset: AnyAsset
  type: 'sym' | 'asym'
}): O.Option<PoolShare> => {
  return FP.pipe(
    shares,
    A.filter(({ asset: sharesAsset, type: sharesType }) => {
      const assetMatch = eqAsset.equals(asset, sharesAsset)
      const typeMatch = type === sharesType
      return assetMatch && typeMatch
    }),
    A.head
  )
}

/**
 * Filters `sym` `Poolshare`'s by given asset `Address`
 */
export const getSymSharesByAddress = (shares: PoolShares, assetAddress: Address): PoolShares =>
  FP.pipe(
    shares,
    A.filter(
      ({ type, assetAddress: oAssetAddress }) =>
        eqOAddress.equals(oAssetAddress, O.some(assetAddress)) && type === 'sym'
    )
  )

export const getPoolAssetDetail = ({
  asset: assetString,
  assetPrice
}: Pick<PoolDetail, 'assetPrice' | 'asset'>): O.Option<PoolAssetDetail> =>
  FP.pipe(
    assetString,
    assetFromString,
    O.fromNullable,
    O.map((asset) => ({
      asset,
      assetPrice: bnOrZero(assetPrice)
    }))
  )

export const getPoolAssetsDetail: (_: Array<Pick<PoolDetail, 'assetPrice' | 'asset'>>) => PoolAssetsDetail = (
  poolDetails
) => FP.pipe(poolDetails, A.filterMap(getPoolAssetDetail))

export const poolsPeriodToPoolPeriod = (period: GetPoolsPeriodEnum): GetPoolPeriodEnum => {
  switch (period) {
    case GetPoolsPeriodEnum.All:
      return GetPoolPeriodEnum.All
    case GetPoolsPeriodEnum._365d:
      return GetPoolPeriodEnum._365d
    case GetPoolsPeriodEnum._180d:
      return GetPoolPeriodEnum._180d
    case GetPoolsPeriodEnum._100d:
      return GetPoolPeriodEnum._100d
    case GetPoolsPeriodEnum._90d:
      return GetPoolPeriodEnum._90d
    case GetPoolsPeriodEnum._30d:
      return GetPoolPeriodEnum._30d
    case GetPoolsPeriodEnum._7d:
      return GetPoolPeriodEnum._7d
    case GetPoolsPeriodEnum._24h:
      return GetPoolPeriodEnum._24h
    case GetPoolsPeriodEnum._1h:
      return GetPoolPeriodEnum._1h
    default:
      throw new Error(`Unexpected period: ${period}`)
  }
}
