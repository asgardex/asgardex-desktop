import { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { ColumnDef } from '@tanstack/react-table'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetail as PoolDetailMaya } from '@xchainjs/xchain-mayamidgard'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { array as A, function as FP, option as O, predicate as P } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { AssetsFilter } from '../../components/AssetsFilter'
import { ProtocolLimit, IncentivePendulum } from '../../components/pool'
import { Table } from '../../components/table'
import { AssetData } from '../../components/uielements/assets/assetData'
import { ManageButton, TextButton } from '../../components/uielements/button'
import { Label } from '../../components/uielements/label'
import { useAppContext } from '../../contexts/AppContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { ordBaseAmount } from '../../helpers/fp/ord'
import { getPoolTableRowsData, isPoolDetails } from '../../helpers/poolHelper'
import { getPoolTableRowsData as getPoolTableRowsDataMaya } from '../../helpers/poolHelperMaya'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useIncentivePendulum } from '../../hooks/useIncentivePendulum'
import { useIncentivePendulumMaya } from '../../hooks/useIncentivePendulumMaya'
import { usePoolCycle } from '../../hooks/usePoolCycle'
import { usePoolCycleMaya } from '../../hooks/usePoolCycleMaya'
import { usePoolFilter } from '../../hooks/usePoolFilter'
import { usePoolWatchlist } from '../../hooks/usePoolWatchlist'
import { usePricePool } from '../../hooks/usePricePool'
import { usePricePoolMaya } from '../../hooks/usePricePoolMaya'
import { useProtocolLimit } from '../../hooks/useProtocolLimit'
import { DEFAULT_NETWORK } from '../../services/const'
import { MayachainLastblockRD } from '../../services/mayachain/types'
import { PendingPoolsState as PendingPoolsStateMaya } from '../../services/midgard/mayaMidgard/types'
import { PendingPoolsState, DEFAULT_POOL_FILTERS } from '../../services/midgard/midgardTypes'
import { ThorchainLastblockRD } from '../../services/thorchain/types'
import { useApp } from '../../store/app/hooks'
import { FixmeType } from '../../types/asgardex'
import { PoolTableRowData, PoolTableRowsData } from './Pools.types'
import {
  filterTableData,
  getBlocksLeftForPendingPoolAsString,
  getBlocksLeftForPendingPoolAsStringMaya,
  isEmptyPool
} from './Pools.utils'
import * as Shared from './PoolsOverview.shared'

export const PendingPools = (): JSX.Element => {
  const { protocol } = useApp()
  const intl = useIntl()
  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)

  const {
    service: {
      pools: { pendingPoolsState$, reloadPendingPools }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: { pendingPoolsState$: pendingPoolStateMaya$, reloadPendingPools: reloadPendingPoolsMaya }
    }
  } = useMidgardMayaContext()

  const { thorchainLastblockState$ } = useThorchainContext()
  const { mayachainLastblockState$ } = useMayachainContext()

  const { setFilter: setPoolFilter, filter: poolFilter } = usePoolFilter('pending')
  const { add: addPoolToWatchlist, remove: removePoolFromWatchlist, list: poolWatchList } = usePoolWatchlist()

  const poolsRD = useObservableState(protocol === THORChain ? pendingPoolsState$ : pendingPoolStateMaya$, RD.pending)
  const thorchainLastblockRD: ThorchainLastblockRD = useObservableState(thorchainLastblockState$, RD.pending)
  const mayachainLastblockRD: MayachainLastblockRD = useObservableState(mayachainLastblockState$, RD.pending)

  const { reload: reloadLimit, data: limitRD } = useProtocolLimit()
  const { data: incentivePendulumThorRD } = useIncentivePendulum()
  const { data: incentivePendulumMayaRD } = useIncentivePendulumMaya()

  const incentivePendulumRD = protocol === THORChain ? incentivePendulumThorRD : incentivePendulumMayaRD

  const isDesktopView = useBreakpoint()?.lg ?? false
  const isXLargeView = useBreakpoint()?.xl ?? false

  // store previous data of pending pools to render these while reloading
  const previousPools = useRef<O.Option<PoolTableRowsData>>(O.none)

  const { poolCycle: poolCycleThor, reloadPoolCycle } = usePoolCycle()
  const { poolCycle: poolCycleMaya, reloadPoolCycle: reloadPoolCycleMaya } = usePoolCycleMaya()

  const poolCycle = protocol === THORChain ? poolCycleThor : poolCycleMaya

  const oNewPoolCycle = useMemo(() => FP.pipe(poolCycle, RD.toOption), [poolCycle])

  const refreshHandler = useCallback(() => {
    if (protocol === THORChain) {
      reloadPendingPools()
      reloadPoolCycle()
    } else {
      reloadPendingPoolsMaya()
      reloadPoolCycleMaya()
    }

    reloadLimit()
  }, [protocol, reloadLimit, reloadPendingPools, reloadPendingPoolsMaya, reloadPoolCycle, reloadPoolCycleMaya])

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()
  const pricePool = protocol === THORChain ? pricePoolThor : pricePoolMaya

  const renderBtnPoolsColumn = useCallback(
    (_: string, { asset }: PoolTableRowData) => {
      return (
        <div className="flex items-center justify-center [&>*:not(:first-child)]:ml-10px">
          <ManageButton
            className="min-w-[120px]"
            variant="manage"
            useBorderButton={true}
            asset={asset}
            isTextView={isDesktopView}
          />
        </div>
      )
    },
    [isDesktopView]
  )

  const renderBlockLeftColumn = useCallback(
    (record: PoolTableRowData) => {
      const { deepest, asset } = record

      const blocksLeft: string = FP.pipe(
        thorchainLastblockRD,
        RD.map((lastblockItems) => getBlocksLeftForPendingPoolAsString(lastblockItems, asset, oNewPoolCycle)),
        RD.getOrElse(() => '--')
      )
      const blocksLeftMaya: string = FP.pipe(
        mayachainLastblockRD,
        RD.map((lastblockItems) => getBlocksLeftForPendingPoolAsStringMaya(lastblockItems, asset, oNewPoolCycle)),
        RD.getOrElse(() => '--')
      )

      return (
        <div className="flex items-center justify-center [&>*:not(:first-child)]:ml-10px">
          <Label className="inline-block w-24 !text-16" align="right">
            {deepest ? (protocol === THORChain ? blocksLeft : blocksLeftMaya) : '--'}
          </Label>
        </div>
      )
    },
    [thorchainLastblockRD, mayachainLastblockRD, protocol, oNewPoolCycle]
  )

  const columns: ColumnDef<PoolTableRowData, FixmeType>[] = useMemo(
    () => [
      {
        accessorKey: 'watched',
        header: '',
        cell: ({ row }) => {
          const { watched, asset } = row.original
          return Shared.renderWatchColumn({
            data: { watched },
            add: () => addPoolToWatchlist(asset),
            remove: () => removePoolFromWatchlist(asset)
          })
        },
        size: 50,
        sortingFn: 'basic'
      },
      {
        accessorKey: 'asset',
        header: intl.formatMessage({ id: 'common.pool' }),
        cell: ({ row }) => (
          <div className="flex w-full items-center">
            <AssetData asset={row.original.asset} network={network} />
          </div>
        ),
        sortingFn: (rowA, rowB) => rowA.original.asset.symbol.localeCompare(rowB.original.asset.symbol)
      },
      {
        accessorKey: 'poolPrice',
        header: intl.formatMessage({ id: 'common.price' }),
        cell: (row) => (
          <Label className="!text-16" align="right" nowrap>
            {formatAssetAmountCurrency({
              amount: baseToAsset(row.getValue()),
              asset: pricePool.asset,
              decimal: 3
            })}
          </Label>
        ),
        sortingFn: (rowA, rowB) => ordBaseAmount.compare(rowA.original.poolPrice, rowB.original.poolPrice)
      },
      ...(isXLargeView
        ? ([
            {
              accessorKey: 'liquidity',
              header: intl.formatMessage({ id: 'common.liquidity' }),
              cell: ({ row }) => {
                const { asset, depthAmount, depthPrice } = row.original
                return (
                  <div className="flex flex-col items-end justify-center font-main">
                    <div className="whitespace-nowrap text-16 text-text0 dark:text-text0d">
                      {formatAssetAmountCurrency({
                        amount: baseToAsset(depthAmount),
                        asset,
                        decimal: 2
                      })}
                    </div>
                    <div className="whitespace-nowrap text-14 text-gray2 dark:text-gray2d">
                      {formatAssetAmountCurrency({
                        amount: baseToAsset(depthPrice),
                        asset: pricePool.asset,
                        decimal: 2
                      })}
                    </div>
                  </div>
                )
              },
              sortingFn: (rowA, rowB) => ordBaseAmount.compare(rowA.original.depthPrice, rowB.original.depthPrice)
            },
            {
              accessorKey: 'blocks',
              header: intl.formatMessage({ id: 'pools.blocksleft' }),
              cell: ({ row }) => renderBlockLeftColumn(row.original),
              sortingFn: (rowA, rowB) => ordBaseAmount.compare(rowA.original.depthPrice, rowB.original.depthPrice)
            }
          ] as ColumnDef<PoolTableRowData, FixmeType>[])
        : []),
      {
        accessorKey: 'actions',
        header: () => (
          <div className="flex items-center justify-center">
            <TextButton size={isDesktopView ? 'normal' : 'large'} onClick={refreshHandler}>
              <div className="flex items-center">
                <ArrowPathIcon className={clsx('h-4 w-4', { 'mr-2': isDesktopView })} />
                {isDesktopView && intl.formatMessage({ id: 'common.refresh' })}
              </div>
            </TextButton>
          </div>
        ),
        cell: ({ row }) => {
          return renderBtnPoolsColumn('', row.original)
        },
        enableSorting: false
      }
    ],
    [
      addPoolToWatchlist,
      intl,
      isDesktopView,
      isXLargeView,
      network,
      pricePool.asset,
      refreshHandler,
      removePoolFromWatchlist,
      renderBlockLeftColumn,
      renderBtnPoolsColumn
    ]
  )

  const renderPoolsTable = useCallback(
    (tableData: PoolTableRowData[], loading = false) => {
      const dataSource = FP.pipe(tableData, filterTableData(poolFilter))

      return (
        <>
          <AssetsFilter
            className="mb-5"
            setFilter={setPoolFilter}
            activeFilter={poolFilter}
            poolFilters={DEFAULT_POOL_FILTERS}
          />
          <ProtocolLimit limit={limitRD} />
          <IncentivePendulum incentivePendulum={incentivePendulumRD} protocol={protocol} />
          <Table columns={columns} data={dataSource} loading={loading} />
        </>
      )
    },
    [poolFilter, setPoolFilter, limitRD, incentivePendulumRD, protocol, columns]
  )

  return (
    <>
      {RD.fold(
        // initial state
        () => renderPoolsTable([], true),
        // loading state
        () => {
          const pools = O.getOrElse(() => [] as PoolTableRowsData)(previousPools.current)
          return renderPoolsTable(pools, true)
        },
        // render error state
        Shared.renderTableError(intl.formatMessage({ id: 'common.refresh' }), refreshHandler),
        // success state
        ({ poolDetails }: PendingPoolsState | PendingPoolsStateMaya): JSX.Element => {
          if (isPoolDetails(poolDetails)) {
            // filter out empty pools
            const poolDetailsFiltered = A.filter<PoolDetail>(P.not(isEmptyPool))(poolDetails)
            const poolViewData = getPoolTableRowsData({
              poolDetails: poolDetailsFiltered,
              pricePoolData: pricePool.poolData,
              watchlist: poolWatchList,
              network
            })
            previousPools.current = O.some(poolViewData)
            return renderPoolsTable(poolViewData)
          } else {
            // filter out empty pools
            const poolDetailsFiltered = A.filter<PoolDetailMaya>(P.not(isEmptyPool))(poolDetails)
            const poolViewData = getPoolTableRowsDataMaya({
              poolDetails: poolDetailsFiltered,
              pricePoolData: pricePool.poolData,
              watchlist: poolWatchList,
              network
            })
            previousPools.current = O.some(poolViewData)
            return renderPoolsTable(poolViewData)
          }
        }
      )(poolsRD)}
    </>
  )
}
