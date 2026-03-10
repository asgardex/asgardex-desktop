import { Balance, Network } from '@xchainjs/xchain-client'
import { AssetCacao, CACAO_DECIMAL, MAYAChain } from '@xchainjs/xchain-mayachain'
import { PoolDetail } from '@xchainjs/xchain-mayamidgard'
import { bnOrZero, assetFromString, baseAmount, BaseAmount, Chain } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { array as A, function as FP, option as O, ord as Ord } from 'fp-ts'

import { PoolsWatchList } from '../../shared/api/io'
import { ONE_CACAO_BASE_AMOUNT } from '../../shared/mock/amount'
import { MimirHalt } from '../services/mayachain/types'
import { PoolDetails } from '../services/midgard/mayaMidgard/types'
import { getPoolDetail, toPoolData } from '../services/midgard/mayaMidgard/utils'
import { PoolAddress, PoolData, PricePool } from '../services/midgard/midgardTypes'
import { PoolTableRowData, PoolTableRowsData } from '../views/pools/Pools.types'
import { getPoolTableRowDataMaya, getValueOfAsset1InAsset2, getValueOfRuneInAsset } from '../views/pools/Pools.utils'
import { convertBaseAmountDecimal, isCacaoAsset, to1e10BaseAmount } from './assetHelper'
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
            }) as PoolTableRowData
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
 * Filters a pool out with highest value of RUNE
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

  // MAYA pool depths are in 1e10 (CACAO base units), so normalize all amounts to CACAO_DECIMAL
  const amount1e10 = convertBaseAmountDecimal(amount, CACAO_DECIMAL)

  return FP.pipe(
    getPoolDetail(poolDetails, asset),
    O.map(toPoolData),
    // calculate value based on `pricePoolData`
    O.map((poolData) => getValueOfAsset1InAsset2(amount1e10, poolData, pricePoolData)),
    O.alt(() => {
      // Calculate CACAO values based on `pricePoolData`
      if (isCacaoAsset(asset)) {
        return O.some(getValueOfRuneInAsset(amount1e10, pricePoolData))
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
  pricePool: { asset: priceAsset, poolData: pricePoolData }
}: {
  balance: Balance
  poolDetails: PoolDetails
  pricePool: PricePool
}): O.Option<BaseAmount> => {
  // no pricing if balance asset === price pool asset
  if (eqAsset.equals(asset, priceAsset)) return O.some(amount)
  if (isCacaoAsset(asset)) {
    const amount1e10 = to1e10BaseAmount(amount)
    return O.some(getValueOfRuneInAsset(amount1e10, pricePoolData))
  }

  return FP.pipe(
    getPoolDetail(poolDetails, asset), // Get the pool detail for the asset
    O.chain((poolDetail) =>
      FP.pipe(
        O.fromNullable(poolDetail.assetPriceUSD), // Extract `assetPriceUSD` safely
        O.map((assetPriceUSD) => {
          // Normalize to CACAO_DECIMAL (1e10) since MAYA pool prices are per 1e10-unit
          const amount1e10 = convertBaseAmountDecimal(amount, CACAO_DECIMAL)
          const usdValue = bnOrZero(assetPriceUSD).multipliedBy(amount1e10.amount()).integerValue(BigNumber.ROUND_DOWN)
          return baseAmount(usdValue, CACAO_DECIMAL)
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
  // Check `HALTMAYATRADING` (provided by `mimir` endpoint) to disable all actions for all pools
  if (mimirHalt.HALTMAYACHAIN) return true

  // Dynamic check for the specific chain halt status
  const haltChainKey = `HALT${chain}CHAIN` as keyof MimirHalt
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
  if (mimirHalt.haltGlobalTrading) return true

  // 2. Dynamic check for the specific chain trading halt status
  const haltTradingKey = `HALT${chain}TRADING` as keyof MimirHalt
  if (mimirHalt[haltTradingKey]) return true

  // 3. Check `chain` is included in `haltedChains` (provided by `inbound_addresses` endpoint)
  return FP.pipe(haltedChains, isChainElem(chain))
}

/**
 * Helper to check if pool trading actions (`ADD`, `WITHDRAW`) have to be disabled
 *
 * |                | ADD | WITHDRAW | SWAP |
 * |----------------|-----|----------|------|
 * | PAUSELP{chain} | NO  | NO       | YES  |
 * | HALT{chain}    | NO  | NO       | NO   |
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
  if (mimirHalt.pauseGlobalLp) return true
  // 2. Dynamic check for the specific chain trading halt status
  const haltTradingKey = `PAUSELP${chain}` as keyof MimirHalt
  if (mimirHalt[haltTradingKey]) return true

  // Check `chain` is included in `haltedChains` (provided by `inbound_addresses` endpoint)
  return FP.pipe(haltedChains, isChainElem(chain))
}

/**
 * Helper to check if pool withdraw actions have to be disabled
 *
 * |                | ADD | WITHDRAW | SWAP |
 * |----------------|-----|----------|------|
 * | PAUSELP{chain} | NO  | NO       | YES  |
 * | HALT{chain}    | NO  | NO       | NO   |
 */
export const disableWithdrawActions = ({
  chain,
  haltedChains,
  mimirHalt
}: {
  chain: Chain
  haltedChains: Chain[]
  mimirHalt: MimirHalt
}) => {
  // Check all `pauseLp{chain}` values (provided by `mimir` endpoint) to disable pool actions
  if (mimirHalt.pauseGlobalLp) return true
  // Maya doesn't seem to have PAUSELPDEPOSIT logic, so we don't check for it
  // 2. Dynamic check for the specific chain trading halt status
  const haltTradingKey = `PAUSELP${chain}` as keyof MimirHalt
  if (mimirHalt[haltTradingKey]) return true
  // Check `chain` is included in `haltedChains` (provided by `inbound_addresses` endpoint)
  return FP.pipe(haltedChains, isChainElem(chain))
}
