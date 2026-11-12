import { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetCacao, AssetRuneNative } from '../../../shared/utils/asset'
import { THORChain } from '../../../shared/utils/chainIds'
import { WalletType } from '../../../shared/wallet/types'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../contexts/WalletContext'
import * as PoolHelpers from '../../helpers/poolHelper'
import * as PoolHelpersMaya from '../../helpers/poolHelperMaya'
import { useIncentivePendulum } from '../../hooks/useIncentivePendulum'
import { useIncentivePendulumMaya } from '../../hooks/useIncentivePendulumMaya'
import { useObservableLayoutState } from '../../hooks/useObservableLayoutState'
import { usePoolFilter } from '../../hooks/usePoolFilter'
import { usePoolStatus } from '../../hooks/usePoolStatus'
import { usePoolWatchlist } from '../../hooks/usePoolWatchlist'
import { usePricePool } from '../../hooks/usePricePool'
import { usePricePoolMaya } from '../../hooks/usePricePoolMaya'
import * as poolsRoutes from '../../routes/pools'
import { DEFAULT_NETWORK } from '../../services/const'
import { PoolsState as MayaPoolState } from '../../services/midgard/mayaMidgard/types'
import { GetPoolsPeriodEnum, PoolsState, DEFAULT_POOL_FILTERS } from '../../services/midgard/midgardTypes'
import { hasImportedKeystore } from '../../services/wallet/util'
import { useApp } from '../../store/app/hooks'
import { PoolTableRowsData } from './Pools.types'
import { filterTableData } from './Pools.utils'
import * as Shared from './PoolsOverview.shared'
import { PoolsSummary } from './PoolsSummary'
import { PoolsTable, PoolsTableRow } from './PoolsTable'
import { PoolsToolbar } from './PoolsToolbar'

const PERIOD_LABELS: Record<GetPoolsPeriodEnum, string> = {
  [GetPoolsPeriodEnum._1h]: '1H',
  [GetPoolsPeriodEnum._24h]: '24H',
  [GetPoolsPeriodEnum._7d]: '7D',
  [GetPoolsPeriodEnum._30d]: '30D',
  [GetPoolsPeriodEnum._90d]: '90D',
  [GetPoolsPeriodEnum._100d]: '100D',
  [GetPoolsPeriodEnum._180d]: '180D',
  [GetPoolsPeriodEnum._365d]: '365D',
  [GetPoolsPeriodEnum.All]: ''
}

export const ActivePools = ({ reloadLimit }: { reloadLimit: () => void }): JSX.Element => {
  const navigate = useNavigate()
  const { protocol } = useApp()
  const intl = useIntl()
  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const {
    keystoreService: { keystoreState$ }
  } = useWalletContext()
  const {
    service: {
      pools: { poolsState$, poolsLoading$, reloadPools, poolsPeriod$, setPoolsPeriod }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: {
        poolsState$: mayaPoolsState$,
        poolsLoading$: mayaPoolsLoading$,
        reloadPools: reloadMayaPools,
        poolsPeriod$: poolsPeriodMaya$,
        setPoolsPeriod: setPoolsPeriodMaya
      }
    }
  } = useMidgardMayaContext()
  const isThorProtocol = protocol === THORChain
  const { data: incentivePendulumThorRD } = useIncentivePendulum(isThorProtocol)
  const { data: incentivePendulumMayaRD } = useIncentivePendulumMaya(!isThorProtocol)
  const incentivePendulumRD = isThorProtocol ? incentivePendulumThorRD : incentivePendulumMayaRD

  const poolsPeriod = useObservableState(isThorProtocol ? poolsPeriod$ : poolsPeriodMaya$, GetPoolsPeriodEnum._30d)

  const keystore = useObservableState(keystoreState$, O.none)
  const hasKeystore = hasImportedKeystore(keystore)

  const { setFilter: setPoolFilter, filter: poolFilter } = usePoolFilter('active')
  const { add: addPoolToWatchlist, remove: removePoolFromWatchlist, list: poolWatchList } = usePoolWatchlist()
  const getPoolStatus = usePoolStatus(protocol)

  const poolsRD = useObservableLayoutState(isThorProtocol ? poolsState$ : mayaPoolsState$, RD.pending)

  // The pools state keeps the last Success while reloading, so it can't tell about a running reload.
  // Use the state of the request instead to show a refresh while rows stay on screen.
  const refreshing = useObservableLayoutState(isThorProtocol ? poolsLoading$ : mayaPoolsLoading$, false)

  const refreshHandler = useCallback(() => {
    if (isThorProtocol) {
      reloadPools()
    } else {
      reloadMayaPools()
    }
    reloadLimit()
  }, [isThorProtocol, reloadLimit, reloadPools, reloadMayaPools])

  const pricePoolThor = usePricePool(isThorProtocol)
  const pricePoolMaya = usePricePoolMaya(!isThorProtocol)
  const pricePool = isThorProtocol ? pricePoolThor : pricePoolMaya

  const onSwap = useCallback(
    (asset: AnyAsset) =>
      navigate(
        poolsRoutes.swap.path({
          source: assetToString(asset),
          target: assetToString(isThorProtocol ? AssetRuneNative : AssetCacao),
          sourceWalletType: isThorProtocol && !hasKeystore ? WalletType.Ledger : DEFAULT_WALLET_TYPE,
          targetWalletType: DEFAULT_WALLET_TYPE
        })
      ),
    [hasKeystore, isThorProtocol, navigate]
  )

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

  const onDetail = useCallback(
    (asset: AnyAsset) => navigate(poolsRoutes.detail.path({ asset: assetToString(asset) })),
    [navigate]
  )

  // store previous data of pools to render these while reloading
  const previousPools = useRef<O.Option<PoolTableRowsData>>(O.none)

  const oPools: O.Option<PoolTableRowsData> = useMemo(() => {
    if (!RD.isSuccess(poolsRD)) return previousPools.current
    const poolViewData = isThorProtocol
      ? PoolHelpers.getPoolTableRowsData({
          poolDetails: (poolsRD.value as PoolsState).poolDetails,
          pricePoolData: pricePool.poolData,
          watchlist: poolWatchList,
          network
        })
      : PoolHelpersMaya.getPoolTableRowsData({
          poolDetails: (poolsRD.value as MayaPoolState).poolDetails,
          pricePoolData: pricePool.poolData,
          watchlist: poolWatchList,
          network
        })
    previousPools.current = O.some(poolViewData)
    return previousPools.current
  }, [isThorProtocol, network, poolWatchList, poolsRD, pricePool.poolData])

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

  if (RD.isFailure(poolsRD)) {
    return Shared.renderTableError(intl.formatMessage({ id: 'common.refresh' }), refreshHandler)(poolsRD.error)
  }

  const loading = !RD.isSuccess(poolsRD)

  return (
    <div className="flex w-full flex-col gap-3">
      <PoolsSummary
        key={`summary-${protocol}`}
        variant="active"
        rows={rows}
        pricePoolAsset={pricePool.asset}
        protocol={protocol}
        incentivePendulum={incentivePendulumRD}
        loading={loading}
      />
      <PoolsToolbar
        poolFilters={DEFAULT_POOL_FILTERS}
        activeFilter={poolFilter}
        setFilter={setPoolFilter}
        period={poolsPeriod}
        onChangePeriod={isThorProtocol ? setPoolsPeriod : setPoolsPeriodMaya}
        refreshing={refreshing}
        onRefresh={refreshHandler}
      />
      <PoolsTable
        key={`table-${protocol}`}
        variant="active"
        rows={filteredRows}
        pricePoolAsset={pricePool.asset}
        network={network}
        loading={loading}
        apyPeriodLabel={PERIOD_LABELS[poolsPeriod]}
        onSwap={onSwap}
        onAdd={onAdd}
        onDetail={onDetail}
        onWatch={addPoolToWatchlist}
        onUnwatch={removePoolFromWatchlist}
      />
    </div>
  )
}
