import { Network } from '@xchainjs/xchain-client'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { Pool } from '@xchainjs/xchain-thornode'
import { AnyAsset, assetFromString, assetToString, bn, bnOrZero } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { array as A, function as FP, option as O } from 'fp-ts'

import { isSupportedChain } from '../../../../shared/utils/chain'
import { PRICE_POOLS_WHITELIST, USD_PRICE_ASSETS } from '../../../const'
import { validAssetForETH } from '../../../helpers/assetHelper'
import { isEthChain } from '../../../helpers/chainHelper'
import { getDeepestPool } from '../../../helpers/poolHelper'
import { PoolsState } from '../midgardTypes'
import { getPoolAssetsDetail, getPricePools, toPoolsData } from './utils'

const ZERO = '0'

const isAvailableStatus = (status: string): boolean => status.toLowerCase() === 'available'

const isUsdPriceAssetString = (assetString: string): boolean =>
  USD_PRICE_ASSETS.some((asset) => assetToString(asset).toLowerCase() === assetString.toLowerCase())

/** Minimal PoolDetail stub for helpers that only read asset/depths/status. */
const stubPoolDetail = (partial: Pick<PoolDetail, 'asset' | 'assetDepth' | 'runeDepth' | 'status'>): PoolDetail => ({
  annualPercentageRate: ZERO,
  assetPrice: ZERO,
  assetPriceUSD: ZERO,
  earnings: ZERO,
  earningsAnnualAsPercentOfDepth: ZERO,
  liquidityUnits: ZERO,
  lpLuvi: ZERO,
  nativeDecimal: '-1',
  poolAPY: ZERO,
  saversAPR: ZERO,
  saversDepth: ZERO,
  saversUnits: ZERO,
  synthSupply: ZERO,
  synthUnits: ZERO,
  totalCollateral: ZERO,
  totalDebtTor: ZERO,
  units: ZERO,
  volume24h: ZERO,
  ...partial
})

/**
 * Midgard-style RUNE-per-asset price from Thornode balances.
 */
export const thornodeAssetPrice = (pool: Pick<Pool, 'balance_asset' | 'balance_rune'>): BigNumber => {
  const assetDepth = bnOrZero(pool.balance_asset)
  if (assetDepth.isZero()) return bn(0)
  return bnOrZero(pool.balance_rune).dividedBy(assetDepth)
}

/**
 * USD per RUNE from the deepest USD pool (by RUNE depth), matching Midgard's
 * "deepest USD pool" basis for `assetPriceUSD`.
 */
export const runePriceUsdFromThornodePools = (pools: readonly Pool[]): O.Option<BigNumber> => {
  const usdDetails: PoolDetail[] = pools
    .filter((pool) => isUsdPriceAssetString(pool.asset) && isAvailableStatus(pool.status))
    .map((pool) =>
      stubPoolDetail({
        asset: pool.asset,
        assetDepth: pool.balance_asset,
        runeDepth: pool.balance_rune,
        status: pool.status
      })
    )

  return FP.pipe(
    getDeepestPool(usdDetails),
    O.chain((deepest) => {
      const runeDepth = bnOrZero(deepest.runeDepth)
      if (runeDepth.isZero()) return O.none
      // USD per RUNE = USDC depth / RUNE depth
      return O.some(bnOrZero(deepest.assetDepth).dividedBy(runeDepth))
    })
  )
}

export const mapThornodePoolToPoolDetail = (pool: Pool, runePriceUSD: BigNumber): O.Option<PoolDetail> => {
  const asset = assetFromString(pool.asset)
  if (!asset) return O.none
  if (!isSupportedChain(asset.chain)) return O.none
  if (!isAvailableStatus(pool.status)) return O.none

  const assetPrice = thornodeAssetPrice(pool)
  const assetPriceUSD = assetPrice.multipliedBy(runePriceUSD)
  const liquidityUnits = pool.LP_units ?? ZERO
  const synthUnits = pool.synth_units ?? ZERO

  return O.some({
    ...stubPoolDetail({
      asset: pool.asset,
      assetDepth: pool.balance_asset,
      runeDepth: pool.balance_rune,
      status: pool.status
    }),
    assetPrice: assetPrice.toString(),
    assetPriceUSD: assetPriceUSD.toString(),
    liquidityUnits,
    nativeDecimal: pool.decimals !== undefined ? String(pool.decimals) : '-1',
    saversDepth: pool.savers_depth ?? ZERO,
    saversUnits: pool.savers_units ?? ZERO,
    synthSupply: pool.synth_supply ?? ZERO,
    synthUnits,
    units: bnOrZero(liquidityUnits).plus(bnOrZero(synthUnits)).toFixed(0)
  })
}

export type ThornodePoolsFallbackParams = {
  pools: readonly Pool[]
  network: Network
}

/**
 * Build a Midgard-shaped `PoolsState` from THORNode `/thorchain/pools`.
 * History/APR fields are stubbed; depths + assetPrice/assetPriceUSD are real.
 */
export const poolsStateFromThornodePools = ({ pools, network }: ThornodePoolsFallbackParams): PoolsState => {
  const runePriceUSD = FP.pipe(
    runePriceUsdFromThornodePools(pools),
    O.getOrElse(() => bn(0))
  )

  const poolDetails: PoolDetail[] = FP.pipe(
    [...pools],
    A.filterMap((pool) => mapThornodePoolToPoolDetail(pool, runePriceUSD)),
    A.filter((detail) => {
      const asset = assetFromString(detail.asset)
      if (!asset) return false
      return !isEthChain(asset.chain) || validAssetForETH(asset, network)
    })
  )

  const poolAssets: AnyAsset[] = FP.pipe(
    poolDetails,
    A.filterMap((detail) => O.fromNullable(assetFromString(detail.asset)))
  )

  const pricePools = O.some(getPricePools(poolDetails, PRICE_POOLS_WHITELIST))

  return {
    poolAssets,
    assetDetails: getPoolAssetsDetail(poolDetails),
    poolDetails,
    poolsData: toPoolsData(poolDetails),
    pricePools
  }
}
