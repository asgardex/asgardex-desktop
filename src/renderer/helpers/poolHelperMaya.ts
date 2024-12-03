import { Balance, Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { PoolDetail } from '@xchainjs/xchain-mayamidgard'
import { bnOrZero, assetFromString, BaseAmount, Chain, baseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Ord from 'fp-ts/lib/Ord'

import { PoolsWatchList } from '../../shared/api/io'
import { ONE_CACAO_BASE_AMOUNT } from '../../shared/mock/amount'
import { PoolAddress, PoolDetails } from '../services/mayaMigard/types'
import { getPoolDetail, toPoolData } from '../services/mayaMigard/utils'
import { MimirHalt } from '../services/thorchain/types'
import { PoolData, PoolTableRowData, PoolTableRowsData, PricePool } from '../views/pools/Pools.types'
import { getPoolTableRowDataMaya, getValueOfAsset1InAsset2, getValueOfRuneInAsset } from '../views/pools/Pools.utils'
import { convertBaseAmountDecimal, isCacaoAsset, to1e8BaseAmount } from './assetHelper'
import { eqAsset, eqChain, eqString } from './fp/eq'
import { ordBaseAmount } from './fp/ord'
import { sequenceTOption, sequenceTOptionFromArray } from './fpHelpers'
import { emptyString } from './stringHelper'

export const sortByDepth = (a: { depthPrice: BaseAmount }, b: { depthPrice: BaseAmount }) =>
  ordBaseAmount.compare(a.depthPrice, b.depthPrice)

const ordByDepth = Ord.Contravariant.contramap(ordBaseAmount, ({ depthPrice }: PoolTableRowData) => depthPrice)

/**
 * MAYA based `PoolData`
 * Note: We don't have a "MAYA" pool in THORChain,
 * but do need such thing for pricing
 */
export const MAYA_POOL_DATA: PoolData = { assetBalance: ONE_CACAO_BASE_AMOUNT, dexBalance: ONE_CACAO_BASE_AMOUNT }

/**
 * MAYA based `PricePool`
 * Note: We don't have a "MAYA" pool in THORChain,
 * but do need such thing for pricing
 */
export const MAYA_PRICE_POOL: PricePool = {
  asset: AssetCacao,
  poolData: MAYA_POOL_DATA
}

/**
 * MAYA based `PoolAddresses`
 * Note: We don't have a "MAYA" pool in THORChain,
 * but do need such thing for handling pool txs
 */
export const MAYA_POOL_ADDRESS: PoolAddress = {
  protocol: MAYAChain,
  chain: MAYAChain,
  // For MAYANative a `MsgNativeTx` is used for pool txs,
  // no need for a pool address, just keep it empty
  address: emptyString,
  halted: false,
  router: O.none
}

// get symbol of deepest pool
export const getDeepestPoolSymbol = (poolDetails: PoolDetails): O.Option<string> =>
  FP.pipe(
    poolDetails,
    getDeepestPool,
    O.chain((poolDetail) => O.fromNullable(poolDetail.asset)),
    O.chain((assetString) => O.fromNullable(assetFromString(assetString))),
    O.map(({ symbol }) => symbol)
  )

export const getPoolTableRowsData = ({
  poolDetails,
  pricePoolData,
  watchlist,
  network
}: {
  poolDetails: PoolDetails
  pricePoolData: PoolData
  watchlist: PoolsWatchList
  network: Network
}): PoolTableRowsData => {
  // get symbol of deepest pool
  const oDeepestPoolSymbol: O.Option<string> = getDeepestPoolSymbol(poolDetails)

  // Transform `PoolDetails` -> PoolRowType
  return FP.pipe(
    poolDetails,
    A.mapWithIndex<PoolDetail, O.Option<PoolTableRowData>>((index, poolDetail) => {
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
        getPoolTableRowDataMaya({ poolDetail, pricePoolData, watchlist, network }),
        O.map(
          (poolTableRowData) =>
            ({
              ...poolTableRowData,
              key: poolDetail?.asset || index.toString(),
              deepest
            } as PoolTableRowData)
        )
      )
    }),
    sequenceTOptionFromArray,
    O.getOrElse(() => [] as PoolTableRowsData),
    // Table does not accept `defaultSortOrder` for depth  for any reason,
    // that's why we sort depth here
    A.sortBy([ordByDepth]),
    // descending sort
    A.reverse
  )
}

/**
 * Filters a pool out with hightest value of RUNE
 */
export const getDeepestPool = (pools: PoolDetails): O.Option<PoolDetail> =>
  pools.reduce((acc: O.Option<PoolDetail>, pool: PoolDetail) => {
    const runeDepth = bnOrZero(pool.runeDepth)
    const prev = O.toNullable(acc)
    return runeDepth.isGreaterThanOrEqualTo(bnOrZero(prev?.runeDepth)) ? O.some(pool) : acc
  }, O.none)

/**
 * Converts Asset's pool price according to runePrice in selectedPriceAsset
 */
export const getAssetPoolPrice = (runePrice: BigNumber) => (poolDetail: Pick<PoolDetail, 'assetPrice'>) =>
  bnOrZero(poolDetail.assetPrice).multipliedBy(runePrice)

/** Deprecating this soon
 * Helper to get a pool price value for a given `Balance`
 */
export const getPoolPriceValue = ({
  balance: { asset, amount },
  poolDetails,
  pricePool: { asset: priceAsset, poolData: pricePoolData }
}: {
  balance: Balance
  poolDetails: PoolDetails
  pricePool: PricePool
}): O.Option<BaseAmount> => {
  // no pricing if balance asset === price pool asset
  if (eqAsset.equals(asset, priceAsset)) return O.some(amount)

  const amount1e8 = isCacaoAsset(asset) ? amount : to1e8BaseAmount(amount)
  return FP.pipe(
    getPoolDetail(poolDetails, asset),
    O.map(toPoolData),
    // calculate value based on `pricePoolData`
    O.map((poolData) => getValueOfAsset1InAsset2(amount1e8, poolData, pricePoolData)),
    O.alt(() => {
      // Calculate RUNE values based on `pricePoolData`
      if (isCacaoAsset(asset)) {
        return O.some(getValueOfRuneInAsset(amount1e8, pricePoolData))
      }
      // In all other cases we don't have any price pool and no price
      return O.none
    }),
    // convert back to original decimal
    O.map((price) => convertBaseAmountDecimal(price, amount.decimal))
  )
}
/**
 * Helper to get the usd value from an asset in maya pools
 * @param param0
 * @returns
 */
export const getUSDValue = ({
  balance: { asset, amount },
  poolDetails,
  pricePool: { asset: priceAsset }
}: {
  balance: Balance
  poolDetails: PoolDetails
  pricePool: PricePool
}): O.Option<BaseAmount> => {
  // no pricing if balance asset === price pool asset
  if (eqAsset.equals(asset, priceAsset)) return O.some(amount)

  return FP.pipe(
    getPoolDetail(poolDetails, asset), // Get the pool detail for the asset
    O.chain((poolDetail) =>
      FP.pipe(
        O.fromNullable(poolDetail.assetPriceUSD), // Extract `assetPriceUSD` safely
        O.map((assetPriceUSD) => {
          const amountDecimal = amount.amount().toNumber() // Convert amount to a decimal number
          const usdValue = Number(assetPriceUSD) * amountDecimal // Multiply by the price in USD
          return baseAmount(usdValue, amount.decimal) // Convert back to `BaseAmount` with 1e8 decimals
        })
      )
    )
  )
}

const isChainElem = A.elem(eqChain)

/**
 * Helper to check if all pool actions (`SWAP`, `ADD`, `WITHDRAW`) have to be disabled
 *
 * |                  | ADD | WITHDRAW | SWAP |
 * |------------------|-----|----------|------|
 * | halt{chain}Chain | NO  | NO       | NO   |
 * | halt{chain}      | NO  | NO       | NO   |
 *
 */
export const disableAllActions = ({
  chain,
  haltedChains,
  mimirHalt
}: {
  chain: Chain
  haltedChains: Chain[]
  mimirHalt: MimirHalt
}) => {
  // Check `haltTHORChain` (provided by `mimir` endpoint) to disable all actions for all pools
  if (mimirHalt.haltMAYAChain) return true

  // Dynamic check for the specific chain halt status
  const haltChainKey = `halt${chain}Chain` as keyof MimirHalt
  if (mimirHalt[haltChainKey]) return true

  // Check `chain` is included in `haltedChains` (provided by `inbound_addresses` endpoint)
  return FP.pipe(haltedChains, isChainElem(chain))
}
/**
 * Helper to check if pool trading actions (`SWAP`, `ADD`) have to be disabled
 *
 * |                    | ADD | WITHDRAW | SWAP |
 * |--------------------|-----|----------|------|
 * | halt{chain}Trading | NO  | YES      | NO   |
 * | halt{chain}        | NO  | NO       | NO   |
 */
export const disableTradingActions = ({
  chain,
  haltedChains,
  mimirHalt
}: {
  chain: Chain
  haltedChains: Chain[]
  mimirHalt: MimirHalt
}) => {
  // 1. Check `haltTrading` (provided by `mimir` endpoint) to disable all actions for all pools
  if (mimirHalt.haltTrading) return true

  // 2. Dynamic check for the specific chain trading halt status
  const haltTradingKey = `halt${chain}Trading` as keyof MimirHalt
  if (mimirHalt[haltTradingKey]) return true

  // 3. Check `chain` is included in `haltedChains` (provided by `inbound_addresses` endpoint)
  return FP.pipe(haltedChains, isChainElem(chain))
}

/**
 * Helper to check if pool trading actions (`ADD`, `WITHDRAW`) have to be disabled
 *
 * |                | ADD | WITHDRAW | SWAP |
 * |----------------|-----|----------|------|
 * | pauseLP{chain} | NO  | NO       | YES  |
 * | halt{chain}    | NO  | NO       | NO   |
 */
export const disablePoolActions = ({
  chain,
  haltedChains,
  mimirHalt
}: {
  chain: Chain
  haltedChains: Chain[]
  mimirHalt: MimirHalt
}) => {
  // Check all `pauseLp{chain}` values (provided by `mimir` endpoint) to disable pool actions
  if (mimirHalt.pauseLp) return true
  // 2. Dynamic check for the specific chain trading halt status
  const haltTradingKey = `pauseLp${chain}` as keyof MimirHalt
  if (mimirHalt[haltTradingKey]) return true

  // Check `chain` is included in `haltedChains` (provided by `inbound_addresses` endpoint)
  return FP.pipe(haltedChains, isChainElem(chain))
}
