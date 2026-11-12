import { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetail as PoolDetailMaya } from '@xchainjs/xchain-mayamidgard'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O, predicate as P } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { THORChain } from '../../../shared/utils/chainIds'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { getPoolTableRowsData, isPoolDetails } from '../../helpers/poolHelper'
import { getPoolTableRowsData as getPoolTableRowsDataMaya } from '../../helpers/poolHelperMaya'
import { useIncentivePendulum } from '../../hooks/useIncentivePendulum'
import { useIncentivePendulumMaya } from '../../hooks/useIncentivePendulumMaya'
import { useObservableLayoutState } from '../../hooks/useObservableLayoutState'
import { usePoolCycle } from '../../hooks/usePoolCycle'
import { usePoolCycleMaya } from '../../hooks/usePoolCycleMaya'
import { usePoolFilter } from '../../hooks/usePoolFilter'
import { usePoolStatus } from '../../hooks/usePoolStatus'
import { usePoolWatchlist } from '../../hooks/usePoolWatchlist'
import { usePricePool } from '../../hooks/usePricePool'
import { usePricePoolMaya } from '../../hooks/usePricePoolMaya'
import * as poolsRoutes from '../../routes/pools'
import { DEFAULT_NETWORK } from '../../services/const'
import { LastblockItems as MayaLastblockItems } from '../../services/mayachain/types'
import { DEFAULT_POOL_FILTERS } from '../../services/midgard/midgardTypes'
import { LastblockItems as ThorLastblockItems } from '../../services/thorchain/types'
import { useApp } from '../../store/app/hooks'
import { PoolTableRowsData } from './Pools.types'
import {
  filterTableData,
  getBlocksLeftForPendingPoolAsString,
  getBlocksLeftForPendingPoolAsStringMaya,
  isEmptyPool
} from './Pools.utils'
import * as Shared from './PoolsOverview.shared'
import { PoolsSummary } from './PoolsSummary'
import { PoolsTable, PoolsTableRow } from './PoolsTable'
import { PoolsToolbar } from './PoolsToolbar'

export const PendingPools = ({ reloadLimit }: { reloadLimit: () => void }): JSX.Element => {
  const navigate = useNavigate()
  const { protocol } = useApp()
  const intl = useIntl()
  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const {
    service: {
      pools: { pendingPoolsState$, pendingPoolsLoading$, reloadPendingPools }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: {
        pendingPoolsState$: pendingPoolStateMaya$,
        pendingPoolsLoading$: pendingPoolsLoadingMaya$,
        reloadPendingPools: reloadPendingPoolsMaya
      }
    }
  } = useMidgardMayaContext()
  const { thorchainLastblockState$ } = useThorchainContext()
  const { mayachainLastblockState$ } = useMayachainContext()
  const isThorProtocol = protocol === THORChain

  const { setFilter: setPoolFilter, filter: poolFilter } = usePoolFilter('pending')
  const { add: addPoolToWatchlist, remove: removePoolFromWatchlist, list: poolWatchList } = usePoolWatchlist()
  const getPoolStatus = usePoolStatus(protocol)

  const poolsRD = useObservableLayoutState(isThorProtocol ? pendingPoolsState$ : pendingPoolStateMaya$, RD.pending)

  // timer(0) does not replay. Pending is synchronous, so the layout subscription replaces the
  // other protocol's height before paint instead of handing it to the wrong blocks-left helper.
  const lastblock$ = useMemo(() => {
    const source$ = (isThorProtocol ? thorchainLastblockState$ : mayachainLastblockState$) as Rx.Observable<
      RD.RemoteData<Error, ThorLastblockItems | MayaLastblockItems>
    >
    return source$.pipe(RxOp.startWith(RD.pending as RD.RemoteData<Error, ThorLastblockItems | MayaLastblockItems>))
  }, [isThorProtocol, mayachainLastblockState$, thorchainLastblockState$])
  const lastblockRD = useObservableLayoutState(lastblock$, RD.pending)

  const { data: incentivePendulumThorRD } = useIncentivePendulum(isThorProtocol)
  const { data: incentivePendulumMayaRD } = useIncentivePendulumMaya(!isThorProtocol)
  const incentivePendulumRD = isThorProtocol ? incentivePendulumThorRD : incentivePendulumMayaRD

  const { poolCycle: poolCycleThor, reloadPoolCycle } = usePoolCycle(isThorProtocol)
  const { poolCycle: poolCycleMaya, reloadPoolCycle: reloadPoolCycleMaya } = usePoolCycleMaya(!isThorProtocol)
  const poolCycle = isThorProtocol ? poolCycleThor : poolCycleMaya
  const oNewPoolCycle = useMemo(() => FP.pipe(poolCycle, RD.toOption), [poolCycle])

  // The pending pools state keeps the last Success while reloading, so it can't tell about a running reload.
  // Use the state of the request instead to show a refresh while rows stay on screen.
  const refreshing = useObservableLayoutState(isThorProtocol ? pendingPoolsLoading$ : pendingPoolsLoadingMaya$, false)

  const refreshHandler = useCallback(() => {
    if (isThorProtocol) {
      reloadPendingPools()
      reloadPoolCycle()
    } else {
      reloadPendingPoolsMaya()
      reloadPoolCycleMaya()
    }
    reloadLimit()
  }, [isThorProtocol, reloadLimit, reloadPendingPools, reloadPendingPoolsMaya, reloadPoolCycle, reloadPoolCycleMaya])

  const pricePoolThor = usePricePool(isThorProtocol)
  const pricePoolMaya = usePricePoolMaya(!isThorProtocol)
  const pricePool = isThorProtocol ? pricePoolThor : pricePoolMaya

  const onAdd = useCallback(
    (asset: AnyAsset) =>
      navigate(
        poolsRoutes.deposit.path({
          asset: assetToString(asset),
          assetWalletType: DEFAULT_WALLET_TYPE,
          dexWalletType: DEFAULT_WALLET_TYPE
        })
      ),
    [navigate]
  )

  const getBlocksLeft = useCallback(
    (asset: AnyAsset): string =>
      FP.pipe(
        lastblockRD,
        RD.map((lastblockItems) =>
          isThorProtocol
            ? getBlocksLeftForPendingPoolAsString(lastblockItems as ThorLastblockItems, asset, oNewPoolCycle)
            : getBlocksLeftForPendingPoolAsStringMaya(lastblockItems as MayaLastblockItems, asset, oNewPoolCycle)
        ),
        RD.getOrElse(() => '--')
      ),
    [isThorProtocol, lastblockRD, oNewPoolCycle]
  )

  // store previous data of pending pools to render these while reloading
  const previousPools = useRef<O.Option<PoolTableRowsData>>(O.none)

  const oPools: O.Option<PoolTableRowsData> = useMemo(() => {
    if (!RD.isSuccess(poolsRD)) return previousPools.current
    const { poolDetails } = poolsRD.value
    // filter out empty pools
    const poolViewData = isPoolDetails(poolDetails)
      ? getPoolTableRowsData({
          poolDetails: A.filter<PoolDetail>(P.not(isEmptyPool))(poolDetails),
          pricePoolData: pricePool.poolData,
          watchlist: poolWatchList,
          network
        })
      : getPoolTableRowsDataMaya({
          poolDetails: A.filter<PoolDetailMaya>(P.not(isEmptyPool))(poolDetails),
          pricePoolData: pricePool.poolData,
          watchlist: poolWatchList,
          network
        })
    previousPools.current = O.some(poolViewData)
    return previousPools.current
  }, [network, poolWatchList, poolsRD, pricePool.poolData])

  const rows: PoolsTableRow[] = useMemo(
    () =>
      FP.pipe(
        oPools,
        O.getOrElse(() => [] as PoolTableRowsData),
        (pools) => pools.map((row) => ({ ...row, poolStatus: getPoolStatus(row.asset) }))
      ),
    [getPoolStatus, oPools]
  )

  const filteredRows = useMemo(() => filterTableData(poolFilter)(rows), [poolFilter, rows])

  // Blocks left are shown for the deepest pending pool only, which is the next one to become active
  const deepestRow = useMemo(() => rows.find(({ deepest }) => deepest), [rows])
  const nextPoolBlocksLeft = deepestRow ? getBlocksLeft(deepestRow.asset) : '--'
  const getRowBlocksLeft = useCallback(
    ({ deepest, asset }: PoolsTableRow) => (deepest ? getBlocksLeft(asset) : '--'),
    [getBlocksLeft]
  )

  if (RD.isFailure(poolsRD)) {
    return Shared.renderTableError(intl.formatMessage({ id: 'common.refresh' }), refreshHandler)(poolsRD.error)
  }

  const loading = !RD.isSuccess(poolsRD)

  return (
    <div className="flex w-full flex-col gap-3">
      <PoolsSummary
        key={`summary-${protocol}`}
        variant="pending"
        rows={rows}
        pricePoolAsset={pricePool.asset}
        protocol={protocol}
        incentivePendulum={incentivePendulumRD}
        nextPoolBlocksLeft={nextPoolBlocksLeft}
        loading={loading}
      />
      <PoolsToolbar
        poolFilters={DEFAULT_POOL_FILTERS}
        activeFilter={poolFilter}
        setFilter={setPoolFilter}
        refreshing={refreshing}
        onRefresh={refreshHandler}
      />
      <PoolsTable
        key={`table-${protocol}`}
        variant="pending"
        rows={filteredRows}
        pricePoolAsset={pricePool.asset}
        network={network}
        loading={loading}
        getBlocksLeft={getRowBlocksLeft}
        onAdd={onAdd}
        onWatch={addPoolToWatchlist}
        onUnwatch={removePoolFromWatchlist}
      />
    </div>
  )
}
