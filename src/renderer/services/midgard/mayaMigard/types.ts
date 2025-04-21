import * as RD from '@devexperts/remote-data-ts'
import { PoolDetail, PoolStatsDetail, SwapHistory } from '@xchainjs/xchain-mayamidgard'
import { AnyAsset, Chain } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { LiveData } from '../../../helpers/rx/liveData'
import { AssetWithAmount } from '../../../types/asgardex'
import { PricePoolAsset } from '../../../views/pools/Pools.types'
import { PoolFeeLD } from '../../chain/types'
import { ApiError } from '../../wallet/types'
import {
  DepthHistoryLD,
  GetDepthHistoryParams,
  GetLiquidityHistoryRequest,
  GetPoolsPeriodEnum,
  GetSwapHistoryRequest,
  HaltedChainsLD,
  PoolAddress,
  PoolAddress$,
  PoolAddressLD,
  PoolData,
  PoolEarningHistoryLD,
  PoolFilter,
  PoolLiquidityHistoryLD,
  PoolLiquidityHistoryParams,
  PoolType,
  PricePools,
  SelectedPricePool,
  SelectedPricePoolAsset,
  Tx,
  TxType,
  ValidatePoolLD
} from '../midgardTypes'

export type PoolAsset = string

export type PoolAssets = AnyAsset[]
export type PoolAssetsRD = RD.RemoteData<Error, PoolAssets>
export type PoolAssetsLD = LiveData<Error, PoolAssets>

export type PoolAssetDetail = {
  asset: AnyAsset
  assetPrice: BigNumber
}

export type PoolAssetDetails = PoolAssetDetail[]
export type PoolAssetDetailsLD = LiveData<Error, PoolAssetDetails>

export type PoolDetailRD = RD.RemoteData<Error, PoolDetail>
export type PoolDetailLD = LiveData<Error, PoolDetail>

export type PoolDetails = PoolDetail[]
export type PoolDetailsRD = RD.RemoteData<Error, PoolDetails>
export type PoolDetailsLD = LiveData<Error, PoolDetails>

/**
 * Hash map for storing `PoolData` (key: string of asset)
 */
export type PoolsDataMap = Record<string /* asset as string */, PoolData>
export type PoolsDataMapRD = RD.RemoteData<Error, PoolsDataMap>

export type PoolsState = {
  assetDetails: PoolAssetDetails
  poolAssets: PoolAssets
  poolDetails: PoolDetails
  poolsData: PoolsDataMap
  pricePools: O.Option<PricePools>
}

export type PoolsStateRD = RD.RemoteData<Error, PoolsState>
export type PoolsStateLD = LiveData<Error, PoolsState>

export type PendingPoolsState = {
  assetDetails: PoolAssetDetails
  poolAssets: PoolAssets
  poolDetails: PoolDetails
}
export type PendingPoolsStateRD = RD.RemoteData<Error, PendingPoolsState>
export type PendingPoolsStateLD = LiveData<Error, PendingPoolsState>

export type PoolStatsDetailRD = RD.RemoteData<Error, PoolStatsDetail>
export type PoolStatsDetailLD = LiveData<Error, PoolStatsDetail>

export type ApiGetSwapHistoryParams = { poolAsset?: AnyAsset } & Omit<GetSwapHistoryRequest, 'pool'>
export type GetSwapHistoryParams = Omit<ApiGetSwapHistoryParams, 'poolAsset'>
export type SwapHistoryRD = RD.RemoteData<Error, SwapHistory>
export type SwapHistoryLD = LiveData<Error, SwapHistory>

export type PoolsService = {
  setPoolsPeriod: (v: GetPoolsPeriodEnum) => void
  poolsPeriod$: Rx.Observable<GetPoolsPeriodEnum>
  poolsState$: LiveData<Error, PoolsState>
  pendingPoolsState$: LiveData<Error, PendingPoolsState>
  allPoolDetails$: LiveData<Error, PoolDetails>
  setSelectedPricePoolAsset: (asset: PricePoolAsset) => void
  selectedPricePoolAsset$: Rx.Observable<SelectedPricePoolAsset>
  selectedPricePool$: Rx.Observable<SelectedPricePool>
  selectedPricePoolAssetSymbol$: Rx.Observable<O.Option<string>>
  reloadPools: FP.Lazy<void>
  reloadPendingPools: FP.Lazy<void>
  reloadAllPools: FP.Lazy<void>
  selectedPoolAddress$: PoolAddress$
  poolAddressesByChain$: (chain: Chain) => PoolAddressLD
  selectedPoolDetail$: PoolDetailLD
  reloadSelectedPoolDetail: (delay?: number) => void
  reloadLiquidityHistory: FP.Lazy<void>
  poolStatsDetail$: PoolStatsDetailLD
  reloadPoolStatsDetail: FP.Lazy<void>
  poolEarningHistory$: PoolEarningHistoryLD
  reloadPoolEarningHistory: FP.Lazy<void>
  getPoolLiquidityHistory$: (parmas: PoolLiquidityHistoryParams) => PoolLiquidityHistoryLD
  getSelectedPoolSwapHistory$: (params: GetSwapHistoryParams) => SwapHistoryLD
  apiGetSwapHistory$: (params: ApiGetSwapHistoryParams) => SwapHistoryLD
  apiGetLiquidityHistory$: (params: GetLiquidityHistoryRequest) => PoolLiquidityHistoryLD
  reloadSwapHistory: FP.Lazy<void>
  getDepthHistory$: (params: GetDepthHistoryParams) => DepthHistoryLD
  reloadDepthHistory: FP.Lazy<void>
  priceRatio$: Rx.Observable<BigNumber>
  availableAssets$: PoolAssetsLD
  validatePool$: (poolAddresses: PoolAddress, chain: Chain) => ValidatePoolLD
  poolsFilters$: Rx.Observable<Record<string, O.Option<PoolFilter>>>
  setPoolsFilter: (poolKey: PoolType, filter: O.Option<PoolFilter>) => void
  outboundAssetFeeByChain$: (chain: Chain) => PoolFeeLD
  haltedChains$: HaltedChainsLD
}

export type Action = {
  date: Date
  /**
   * Inbound transactions related to the action
   */
  in: Tx[]
  /**
   * Outbound transactions related to the action
   */
  height: string
  out: Tx[]
  type: TxType
  pools: string[]
  status: string
  fees?: AssetWithAmount[]
  slip?: number
}

type Actions = Action[]

export type ActionsPage = {
  total: number
  actions: Actions
}

export type ActionsPageRD = RD.RemoteData<ApiError, ActionsPage>
export type ActionsPageLD = LiveData<ApiError, ActionsPage>
