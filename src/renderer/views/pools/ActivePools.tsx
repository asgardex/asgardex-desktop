import { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { ColumnDef } from '@tanstack/react-table'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, assetToString, baseToAsset, bn, formatAssetAmountCurrency, formatBN } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetCacao, AssetRuneNative } from '../../../shared/utils/asset'
import { WalletType } from '../../../shared/wallet/types'
import { AssetsFilter } from '../../components/AssetsFilter'
import { ProtocolLimit, IncentivePendulum } from '../../components/pool'
import { Table } from '../../components/table'
import { AssetData } from '../../components/uielements/assets/assetData'
import { TextButton } from '../../components/uielements/button'
import { Action as ActionButtonAction, ActionButton } from '../../components/uielements/button/ActionButton'
import { Label } from '../../components/uielements/label'
import { PoolsPeriodSelector } from '../../components/uielements/pools/PoolsPeriodSelector'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { ordBaseAmount } from '../../helpers/fp/ord'
import * as PoolHelpers from '../../helpers/poolHelper'
import * as PoolHelpersMaya from '../../helpers/poolHelperMaya'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useIncentivePendulum } from '../../hooks/useIncentivePendulum'
import { useIncentivePendulumMaya } from '../../hooks/useIncentivePendulumMaya'
import { usePoolFilter } from '../../hooks/usePoolFilter'
import { usePoolWatchlist } from '../../hooks/usePoolWatchlist'
import { usePricePool } from '../../hooks/usePricePool'
import { usePricePoolMaya } from '../../hooks/usePricePoolMaya'
import { useProtocolLimit } from '../../hooks/useProtocolLimit'
import * as poolsRoutes from '../../routes/pools'
import { DEFAULT_NETWORK } from '../../services/const'
import { PoolsState as MayaPoolState } from '../../services/midgard/mayaMidgard/types'
import { GetPoolsPeriodEnum, PoolsState, DEFAULT_POOL_FILTERS } from '../../services/midgard/midgardTypes'
import { hasImportedKeystore } from '../../services/wallet/util'
import { useApp } from '../../store/app/hooks'
import { FixmeType } from '../../types/asgardex'
import { PoolTableRowData, PoolTableRowsData } from './Pools.types'
import { filterTableData } from './Pools.utils'
import * as Shared from './PoolsOverview.shared'

export const ActivePools = (): JSX.Element => {
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
      pools: { poolsState$, reloadPools, poolsPeriod$, setPoolsPeriod }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: {
        poolsState$: mayaPoolsState$,
        reloadPools: reloadMayaPools,
        poolsPeriod$: poolsPeriodMaya$,
        setPoolsPeriod: setPoolsPeriodMaya
      }
    }
  } = useMidgardMayaContext()
  const { reload: reloadLimit, data: limitRD } = useProtocolLimit()
  const { data: incentivePendulumThorRD } = useIncentivePendulum()
  const { data: incentivePendulumMayaRD } = useIncentivePendulumMaya()

  const incentivePendulumRD = protocol === THORChain ? incentivePendulumThorRD : incentivePendulumMayaRD

  const poolsPeriod = useObservableState(
    protocol === THORChain ? poolsPeriod$ : poolsPeriodMaya$,
    GetPoolsPeriodEnum._30d
  )

  const keystore = useObservableState(keystoreState$, O.none)
  const hasKeystore = !hasImportedKeystore(keystore)

  const { setFilter: setPoolFilter, filter: poolFilter } = usePoolFilter('active')
  const { add: addPoolToWatchlist, remove: removePoolFromWatchlist, list: poolWatchList } = usePoolWatchlist()

  const poolsThorRD = useObservableState(poolsState$, RD.pending)
  const poolsMayaRD = useObservableState(mayaPoolsState$, RD.pending)

  const poolsRD = protocol === THORChain ? poolsThorRD : poolsMayaRD

  const isDesktopView = useBreakpoint()?.lg ?? false
  const isLargeScreen = useBreakpoint()?.xl ?? false
  const isXLargeScreen = useBreakpoint()?.xxl ?? false

  // store previous data of pools to render these while reloading
  const previousPools = useRef<O.Option<PoolTableRowsData>>(O.none)

  const refreshHandler = useCallback(() => {
    if (protocol === THORChain) {
      reloadPools()
    } else {
      reloadMayaPools()
    }

    reloadLimit()
  }, [protocol, reloadLimit, reloadPools, reloadMayaPools])

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()
  const pricePool = protocol === THORChain ? pricePoolThor : pricePoolMaya

  const renderBtnPoolsColumn = useCallback(
    (asset: AnyAsset) => {
      const actions: ActionButtonAction[] =
        protocol === THORChain
          ? [
              {
                label: intl.formatMessage({ id: 'common.swap' }),
                callback: () => {
                  navigate(
                    poolsRoutes.swap.path({
                      source: assetToString(asset),
                      target: assetToString(AssetRuneNative),
                      sourceWalletType: hasKeystore ? DEFAULT_WALLET_TYPE : WalletType.Ledger,
                      targetWalletType: DEFAULT_WALLET_TYPE
                    })
                  )
                }
              },
              {
                label: intl.formatMessage({ id: 'common.add' }),
                callback: () => {
                  navigate(
                    poolsRoutes.deposit.path({
                      asset: assetToString(asset),
                      assetWalletType: DEFAULT_WALLET_TYPE,
                      dexWalletType: DEFAULT_WALLET_TYPE
                    })
                  )
                }
              }
            ]
          : [
              {
                label: intl.formatMessage({ id: 'common.swap' }),
                callback: () => {
                  navigate(
                    poolsRoutes.swap.path({
                      source: assetToString(asset),
                      target: assetToString(AssetCacao),
                      sourceWalletType: DEFAULT_WALLET_TYPE,
                      targetWalletType: DEFAULT_WALLET_TYPE
                    })
                  )
                }
              },
              {
                label: intl.formatMessage({ id: 'common.add' }),
                callback: () => {
                  navigate(
                    poolsRoutes.deposit.path({
                      asset: assetToString(asset),
                      assetWalletType: DEFAULT_WALLET_TYPE,
                      dexWalletType: DEFAULT_WALLET_TYPE
                    })
                  )
                }
              }
            ]

      return (
        <div className="flex items-center justify-center [&>*:not(:first-child)]:ml-10px">
          <ActionButton size="normal" actions={actions} />
        </div>
      )
    },
    [protocol, hasKeystore, intl, navigate]
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
      ...(isXLargeScreen
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
              accessorKey: 'volume',
              header: intl.formatMessage({ id: 'pools.24hvol' }),
              cell: ({ row }) => {
                const { asset, volumeAmount, volumePrice } = row.original
                return (
                  <Label className="!text-16" align="right" nowrap>
                    <div className="flex flex-col items-end justify-center font-main">
                      <div className="whitespace-nowrap text-16 text-text0 dark:text-text0d">
                        {formatAssetAmountCurrency({
                          amount: baseToAsset(volumeAmount),
                          asset,
                          decimal: 2
                        })}
                      </div>
                      <div className="whitespace-nowrap text-14 text-gray2 dark:text-gray2d">
                        {formatAssetAmountCurrency({
                          amount: baseToAsset(volumePrice),
                          asset: pricePool.asset,
                          decimal: 2
                        })}
                      </div>
                    </div>
                  </Label>
                )
              },
              sortingFn: (rowA, rowB) => ordBaseAmount.compare(rowA.original.volumePrice, rowB.original.volumePrice)
            }
          ] as ColumnDef<PoolTableRowData, FixmeType>[])
        : []),
      ...(isLargeScreen
        ? ([
            {
              accessorKey: 'apy',
              header: () => (
                <div className="flex flex-col items-center">
                  <div className="font-main text-[12px]">{intl.formatMessage({ id: 'pools.apy' })}</div>
                  <PoolsPeriodSelector
                    selectedValue={poolsPeriod}
                    onChange={protocol === THORChain ? setPoolsPeriod : setPoolsPeriodMaya}
                  />
                </div>
              ),
              cell: ({ row }) => {
                const { apy } = row.original

                return (
                  <Label className="!text-16" align="center" nowrap>
                    {formatBN(bn(apy), 2)}%
                  </Label>
                )
              }
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
          const { asset } = row.original
          return renderBtnPoolsColumn(asset)
        },
        enableSorting: false
      }
    ],
    [
      intl,
      isDesktopView,
      isLargeScreen,
      isXLargeScreen,
      network,
      poolsPeriod,
      pricePool.asset,
      protocol,
      addPoolToWatchlist,
      refreshHandler,
      removePoolFromWatchlist,
      renderBtnPoolsColumn,
      setPoolsPeriod,
      setPoolsPeriodMaya
    ]
  )

  const renderPoolsTable = useCallback(
    (tableData: PoolTableRowData[], loading = false) => {
      const dataSource = FP.pipe(tableData, filterTableData(poolFilter))

      return (
        <>
          <AssetsFilter
            className="mb-5"
            activeFilter={poolFilter}
            setFilter={setPoolFilter}
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
        (poolsState) => {
          if (protocol === THORChain) {
            const { poolDetails } = poolsState as PoolsState // Cast to the correct type
            const poolViewData = PoolHelpers.getPoolTableRowsData({
              poolDetails,
              pricePoolData: pricePool.poolData,
              watchlist: poolWatchList,
              network
            })
            previousPools.current = O.some(poolViewData)
            return renderPoolsTable(poolViewData)
          } else {
            const { poolDetails } = poolsState as MayaPoolState // Cast to the correct type)
            const poolViewData = PoolHelpersMaya.getPoolTableRowsData({
              poolDetails,
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
