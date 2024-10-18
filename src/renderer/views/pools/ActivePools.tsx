import React, { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  AnyAsset,
  assetToString,
  BaseAmount,
  baseToAsset,
  bn,
  formatAssetAmountCurrency,
  formatBN
} from '@xchainjs/xchain-util'
import { Grid } from 'antd'
import { ColumnsType, ColumnType } from 'antd/lib/table'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetCacao, AssetRuneNative } from '../../../shared/utils/asset'
import { ProtocolLimit, IncentivePendulum } from '../../components/pool'
import { Action as ActionButtonAction, ActionButton } from '../../components/uielements/button/ActionButton'
import { PoolsPeriodSelector } from '../../components/uielements/pools/PoolsPeriodSelector'
import { Table } from '../../components/uielements/table'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { ordBaseAmount, ordNumber } from '../../helpers/fp/ord'
import * as PoolHelpers from '../../helpers/poolHelper'
import * as PoolHelpersMaya from '../../helpers/poolHelperMaya'
import { useDex } from '../../hooks/useDex'
import { useIncentivePendulum } from '../../hooks/useIncentivePendulum'
import { useIncentivePendulumMaya } from '../../hooks/useIncentivePendulumMaya'
import { usePoolFilter } from '../../hooks/usePoolFilter'
import { usePoolWatchlist } from '../../hooks/usePoolWatchlist'
import { usePricePool } from '../../hooks/usePricePool'
import { usePricePoolMaya } from '../../hooks/usePricePoolMaya'
import { useProtocolLimit } from '../../hooks/useProtocolLimit'
import * as poolsRoutes from '../../routes/pools'
import * as saversRoutes from '../../routes/pools/savers'
import { DEFAULT_NETWORK } from '../../services/const'
import {
  PoolsState as MayaPoolState,
  GetPoolsPeriodEnum as GetPoolsPeriodEnumMaya
} from '../../services/mayaMigard/types'
import { PoolsState, DEFAULT_POOL_FILTERS, GetPoolsPeriodEnum } from '../../services/midgard/types'
import { hasImportedKeystore } from '../../services/wallet/util'
import { PoolTableRowData, PoolTableRowsData } from './Pools.types'
import { filterTableData } from './Pools.utils'
import * as Shared from './PoolsOverview.shared'
import * as Styled from './PoolsOverview.styles'

export const ActivePools: React.FC = (): JSX.Element => {
  const navigate = useNavigate()
  const intl = useIntl()
  const { dex } = useDex()
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

  const incentivePendulumRD = dex.chain === THORChain ? incentivePendulumThorRD : incentivePendulumMayaRD

  const poolsPeriod = useObservableState(
    dex.chain === THORChain ? poolsPeriod$ : poolsPeriodMaya$,
    GetPoolsPeriodEnum._30d
  )

  const keystore = useObservableState(keystoreState$, O.none)
  const hasKeystore = !hasImportedKeystore(keystore)

  const { setFilter: setPoolFilter, filter: poolFilter } = usePoolFilter('active')
  const { add: addPoolToWatchlist, remove: removePoolFromWatchlist, list: poolWatchList } = usePoolWatchlist()

  const poolsThorRD = useObservableState(poolsState$, RD.pending)
  const poolsMayaRD = useObservableState(mayaPoolsState$, RD.pending)

  const poolsRD = dex.chain === THORChain ? poolsThorRD : poolsMayaRD

  const isDesktopView = Grid.useBreakpoint()?.lg ?? false
  const isLargeScreen = Grid.useBreakpoint()?.xl ?? false
  const isXLargeScreen = Grid.useBreakpoint()?.xxl ?? false

  // store previous data of pools to render these while reloading
  const previousPools = useRef<O.Option<PoolTableRowsData>>(O.none)

  const refreshHandler = useCallback(() => {
    if (dex.chain === THORChain) {
      reloadPools()
    } else {
      reloadMayaPools()
    }

    reloadLimit()
  }, [dex, reloadLimit, reloadPools, reloadMayaPools])

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()
  const pricePool = dex.chain === THORChain ? pricePoolThor : pricePoolMaya

  const renderBtnPoolsColumn = useCallback(
    (_: string, { asset }: { asset: AnyAsset }) => {
      const actions: ActionButtonAction[] =
        dex.chain === THORChain
          ? [
              {
                label: intl.formatMessage({ id: 'common.swap' }),
                callback: () => {
                  navigate(
                    poolsRoutes.swap.path({
                      source: assetToString(asset),
                      target: assetToString(AssetRuneNative),
                      sourceWalletType: hasKeystore ? DEFAULT_WALLET_TYPE : 'ledger',
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
                      runeWalletType: DEFAULT_WALLET_TYPE
                    })
                  )
                }
              },
              {
                label: intl.formatMessage({ id: 'common.earn' }),
                callback: () => {
                  navigate(saversRoutes.earn.path({ asset: assetToString(asset), walletType: DEFAULT_WALLET_TYPE }))
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
                      runeWalletType: DEFAULT_WALLET_TYPE
                    })
                  )
                }
              }
              // {
              //   label: intl.formatMessage({ id: 'common.earn' }),
              //   callback: () => {
              //     navigate(saversRoutes.earn.path({ asset: assetToString(asset), walletType: DEFAULT_WALLET_TYPE }))
              //   }
              // }
            ]

      return (
        <Styled.TableAction>
          <ActionButton size="normal" actions={actions} />
        </Styled.TableAction>
      )
    },

    [dex, hasKeystore, intl, navigate]
  )

  const btnPoolsColumn = useCallback(
    <T extends { asset: AnyAsset }>(): ColumnType<T> => ({
      key: 'btn',
      title: Shared.renderRefreshBtnColTitle({
        title: intl.formatMessage({ id: 'common.refresh' }),
        clickHandler: refreshHandler,
        iconOnly: !isDesktopView
      }),
      width: 280,
      render: renderBtnPoolsColumn
    }),
    [refreshHandler, intl, renderBtnPoolsColumn, isDesktopView]
  )

  const renderVolumeColumn = useCallback(
    ({ asset, volumePrice, volumeAmount }: { asset: AnyAsset; volumePrice: BaseAmount; volumeAmount: BaseAmount }) => (
      <Styled.Label align="right" nowrap>
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
      </Styled.Label>
    ),
    [pricePool]
  )

  const sortVolumeColumn = useCallback(
    (a: { volumePrice: BaseAmount }, b: { volumePrice: BaseAmount }) =>
      ordBaseAmount.compare(a.volumePrice, b.volumePrice),
    []
  )
  const volumeColumn = useCallback(
    <T extends { volumePrice: BaseAmount }>(): ColumnType<T> => ({
      key: 'vol',
      align: 'right',
      title: intl.formatMessage({ id: 'pools.24hvol' }),
      render: renderVolumeColumn,
      sorter: sortVolumeColumn,
      sortDirections: ['descend', 'ascend']
    }),
    [intl, renderVolumeColumn, sortVolumeColumn]
  )

  const renderAPYColumn = useCallback(
    ({ apy }: { apy: number }) => (
      <Styled.Label align="center" nowrap>
        {formatBN(bn(apy), 2)}%
      </Styled.Label>
    ),
    []
  )

  const sortAPYColumn = useCallback((a: { apy: number }, b: { apy: number }) => ordNumber.compare(a.apy, b.apy), [])
  const apyColumn = useCallback(
    <T extends { apy: number }>(
      poolsPeriod: GetPoolsPeriodEnum | GetPoolsPeriodEnumMaya,
      dex: string // Add a parameter to accept the 'dex' value
    ): ColumnType<T> => {
      // Determine which setPoolsPeriod function to use based on the 'dex' value
      const currentSetPoolsPeriod = dex === THORChain ? setPoolsPeriod : setPoolsPeriodMaya

      return {
        key: 'apy',
        align: 'center',
        title: (
          <div className="flex flex-col items-center">
            <div className="font-main text-[12px]">{intl.formatMessage({ id: 'pools.apy' })}</div>
            <PoolsPeriodSelector selectedValue={poolsPeriod} onChange={currentSetPoolsPeriod} />
          </div>
        ),
        render: renderAPYColumn,
        sorter: sortAPYColumn,
        sortDirections: ['descend', 'ascend']
      }
    },
    [intl, renderAPYColumn, sortAPYColumn, setPoolsPeriod, setPoolsPeriodMaya] // Include both setPoolsPeriod functions in the dependency array
  )

  const desktopPoolsColumns: ColumnsType<PoolTableRowData> = useMemo(
    () =>
      FP.pipe(
        [
          O.some(Shared.watchColumn<PoolTableRowData>(addPoolToWatchlist, removePoolFromWatchlist)),
          O.some(Shared.poolColumn<PoolTableRowData>(intl.formatMessage({ id: 'common.pool' }))),
          O.some(Shared.assetColumn<PoolTableRowData>(intl.formatMessage({ id: 'common.asset' }))),
          O.some(Shared.priceColumn<PoolTableRowData>(intl.formatMessage({ id: 'common.price' }), pricePool.asset)),
          isXLargeScreen
            ? O.some(
                Shared.depthColumn<PoolTableRowData>(intl.formatMessage({ id: 'common.liquidity' }), pricePool.asset)
              )
            : O.none,
          isXLargeScreen ? O.some(volumeColumn<PoolTableRowData>()) : O.none,
          isLargeScreen ? O.some(apyColumn<PoolTableRowData>(poolsPeriod, dex.chain)) : O.none,
          O.some(btnPoolsColumn<PoolTableRowData>())
        ],
        A.filterMap(FP.identity)
      ),
    [
      addPoolToWatchlist,
      removePoolFromWatchlist,
      intl,
      pricePool,
      volumeColumn,
      isLargeScreen,
      isXLargeScreen,
      apyColumn,
      poolsPeriod,
      dex,
      btnPoolsColumn
    ]
  )

  const mobilePoolsColumns: ColumnsType<PoolTableRowData> = useMemo(
    () => [
      Shared.poolColumnMobile(intl.formatMessage({ id: 'common.pool' })),
      Shared.assetColumn(intl.formatMessage({ id: 'common.asset' })),
      btnPoolsColumn()
    ],
    [btnPoolsColumn, intl]
  )

  const renderPoolsTable = useCallback(
    (tableData: PoolTableRowData[], loading = false) => {
      const columns = isDesktopView ? desktopPoolsColumns : mobilePoolsColumns
      const dataSource = FP.pipe(tableData, filterTableData(poolFilter))

      return (
        <>
          <Styled.AssetsFilter activeFilter={poolFilter} setFilter={setPoolFilter} poolFilters={DEFAULT_POOL_FILTERS} />
          <ProtocolLimit limit={limitRD} />
          <IncentivePendulum incentivePendulum={incentivePendulumRD} dex={dex} />
          <Table columns={columns} dataSource={dataSource} loading={loading} rowKey="key" />
        </>
      )
    },
    [
      isDesktopView,
      desktopPoolsColumns,
      mobilePoolsColumns,
      poolFilter,
      setPoolFilter,
      limitRD,
      incentivePendulumRD,
      dex
    ]
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
          if (dex.chain === THORChain) {
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
