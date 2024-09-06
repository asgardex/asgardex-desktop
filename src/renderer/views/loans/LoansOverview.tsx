import { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  AnyAsset,
  assetToString,
  BaseAmount,
  baseToAsset,
  Chain,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import { Grid } from 'antd'
import { ColumnsType, ColumnType } from 'antd/lib/table'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { FlatButton } from '../../components/uielements/button'
import { Table } from '../../components/uielements/table'
import { AssetUSDC, DEFAULT_WALLET_TYPE } from '../../const'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { ordBaseAmount, ordBigNumber } from '../../helpers/fp/ord'
import { sequenceTRD } from '../../helpers/fpHelpers'
import { getLoansTableRowsData, ordCollateralByDepth } from '../../helpers/loans'
import * as PoolHelpers from '../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../helpers/poolHelperMaya'
import { useDex } from '../../hooks/useDex'
import { useNetwork } from '../../hooks/useNetwork'
import { usePoolWatchlist } from '../../hooks/usePoolWatchlist'
import * as poolsRoutes from '../../routes/pools'
import * as lendingRoutes from '../../routes/pools/lending'
import { PoolsState as PoolStateMaya, PoolDetails as PoolDetailsMaya } from '../../services/mayaMigard/types'
import { PoolDetails, PoolsState } from '../../services/midgard/types'
import type { MimirHalt } from '../../services/thorchain/types'
import * as Shared from '../pools/PoolsOverview.shared'
import type { LoansTableRowData, LoansTableRowsData } from './Loans.types'

export type Props = {
  haltedChains: Chain[]
  mimirHalt: MimirHalt
  walletLocked: boolean
}

export const LoansOverview: React.FC<Props> = (props): JSX.Element => {
  const { haltedChains, mimirHalt, walletLocked } = props
  const intl = useIntl()
  const navigate = useNavigate()
  const { network } = useNetwork()
  const { dex } = useDex()

  const {
    service: {
      pools: { poolsState$, reloadPools, selectedPricePool$ }
    }
  } = useMidgardContext()

  const {
    service: {
      pools: { poolsState$: mayaPoolsState$, reloadPools: reloadMayaPools, selectedPricePool$: selectedPricePoolMaya$ }
    }
  } = useMidgardMayaContext()

  const refreshHandler = useCallback(() => {
    if (dex.chain === THORChain) {
      reloadPools()
    } else {
      reloadMayaPools()
    }
  }, [dex, reloadPools, reloadMayaPools])

  const selectedPricePool = useObservableState(
    dex.chain === THORChain ? selectedPricePool$ : selectedPricePoolMaya$,
    dex.chain === THORChain ? PoolHelpers.RUNE_PRICE_POOL : MAYA_PRICE_POOL
  )

  const poolsRD = useObservableState(dex.chain === THORChain ? poolsState$ : mayaPoolsState$, RD.pending)

  // store previous data of pools to render these while reloading
  const previousCollateral = useRef<O.Option<LoansTableRowsData>>(O.none)

  const isDesktopView = Grid.useBreakpoint()?.lg ?? false

  const { add: addPoolToWatchlist, remove: removePoolFromWatchlist, list: poolWatchList } = usePoolWatchlist()

  const collateralColumn = useCallback(
    <T extends { asset: AnyAsset; collateral: BaseAmount; collateralPrice: BaseAmount }>(
      pricePoolAsset: AnyAsset
    ): ColumnType<T> => ({
      key: 'collateral',
      align: 'right',
      title: intl.formatMessage({ id: 'common.collateral' }),
      render: ({
        asset,
        collateral,
        collateralPrice
      }: {
        asset: AnyAsset
        collateral: BaseAmount
        collateralPrice: BaseAmount
      }) => (
        <div className="flex flex-col items-end justify-center font-main">
          <div className="whitespace-nowrap text-16 text-text0 dark:text-text0d">
            {formatAssetAmountCurrency({
              amount: baseToAsset(collateral),
              asset,
              decimal: 3
            })}
          </div>
          <div className="whitespace-nowrap text-14 text-gray2 dark:text-gray2d">
            {formatAssetAmountCurrency({
              amount: baseToAsset(collateralPrice),
              asset: pricePoolAsset,
              decimal: 2
            })}
          </div>
        </div>
      ),
      sorter: ordCollateralByDepth,
      sortDirections: ['descend', 'ascend'],
      // Note: `defaultSortOrder` has no effect here, that's we do a default sort in `getPoolTableRowsData`
      defaultSortOrder: 'descend'
    }),
    [intl]
  )

  const debtColumn = useCallback(
    <T extends { debt: BaseAmount }>(pricePoolAsset: AnyAsset): ColumnType<T> => {
      return {
        key: 'debt',
        align: 'center',
        title: (
          <div className="flex flex-col items-center">
            <div className="font-main text-[12px]">{intl.formatMessage({ id: 'common.debt' })}</div>
          </div>
        ),
        render: ({ debt }: { debt: BaseAmount }) => (
          <div className="font-main text-16">
            {formatAssetAmountCurrency({
              amount: baseToAsset(debt),
              asset: pricePoolAsset,
              decimal: 2
            })}
          </div>
        ),
        sorter: (a: { debt: BaseAmount }, b: { debt: BaseAmount }) => ordBaseAmount.compare(a.debt, b.debt),
        sortDirections: ['descend', 'ascend']
      }
    },
    [intl]
  )

  const filledColumn = useCallback(
    <T extends { filled: BigNumber }>(): ColumnType<T> => ({
      key: 'filled',
      align: 'center',
      title: intl.formatMessage({ id: 'pools.filled' }),
      render: ({ filled }: { filled: BigNumber }) => (
        <div className="flex flex-col justify-start">
          <div className="font-main text-16">Full</div>
          <div className="relative my-[6px] h-[5px] w-full bg-gray1 dark:bg-gray1d">
            <div
              className="absolute h-[5px] bg-turquoise"
              style={{ width: `${Math.min(filled.toNumber(), 100) /* max. 100% */}%` }}></div>
          </div>
        </div>
      ),
      sorter: (a: { filled: BigNumber }, b: { filled: BigNumber }) => ordBigNumber.compare(a.filled, b.filled),
      sortDirections: ['descend', 'ascend']
    }),
    [intl]
  )

  const renderBtnColumn = useCallback(
    (_: string, { asset }: { asset: AnyAsset }) => {
      const { chain } = asset
      const disableAllPoolActions = PoolHelpers.disableAllActions({ chain, haltedChains, mimirHalt })
      const disableTradingActions = PoolHelpers.disableTradingActions({
        chain,
        haltedChains,
        mimirHalt
      })
      const disablePoolActions = PoolHelpers.disablePoolActions({
        chain,
        haltedChains,
        mimirHalt
      })

      const disabled =
        disableAllPoolActions || disableTradingActions || disablePoolActions || walletLocked || dex.chain === 'MAYA'

      const onClickHandler = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
        event.preventDefault()
        event.stopPropagation()
        navigate(
          lendingRoutes.borrow.path({
            asset: assetToString(asset),
            walletType: DEFAULT_WALLET_TYPE,
            borrowAsset: assetToString(AssetUSDC), //tobefixed
            borrowWalletType: DEFAULT_WALLET_TYPE
          })
        )
      }

      return (
        <div className="relative flex flex-col items-center justify-center">
          <FlatButton className="min-w-[120px]" disabled={disabled} size="normal" onClick={onClickHandler}>
            {intl.formatMessage({ id: 'common.borrow' })}
          </FlatButton>
        </div>
      )
    },

    [dex, haltedChains, intl, mimirHalt, navigate, walletLocked]
  )

  const btnColumn = useCallback(
    <T extends { asset: AnyAsset }>(): ColumnType<T> => ({
      key: 'btn',
      title: Shared.renderRefreshBtnColTitle({
        title: intl.formatMessage({ id: 'common.refresh' }),
        clickHandler: refreshHandler,
        iconOnly: !isDesktopView
      }),
      width: 280,
      render: renderBtnColumn
    }),
    [refreshHandler, intl, renderBtnColumn, isDesktopView]
  )

  const desktopColumns: ColumnsType<LoansTableRowData> = useMemo(
    () => [
      Shared.watchColumn(addPoolToWatchlist, removePoolFromWatchlist),
      Shared.poolColumn(intl.formatMessage({ id: 'common.pool' })),
      Shared.assetColumn(intl.formatMessage({ id: 'common.asset' })),
      collateralColumn<LoansTableRowData>(selectedPricePool.asset),
      filledColumn<LoansTableRowData>(),
      debtColumn<LoansTableRowData>(selectedPricePool.asset),
      btnColumn()
    ],
    [
      addPoolToWatchlist,
      debtColumn,
      btnColumn,
      collateralColumn,
      filledColumn,
      intl,
      removePoolFromWatchlist,
      selectedPricePool.asset
    ]
  )

  const mobileColumns: ColumnsType<LoansTableRowData> = useMemo(
    () => [
      Shared.poolColumnMobile<LoansTableRowData>(intl.formatMessage({ id: 'common.pool' })),
      Shared.assetColumn<LoansTableRowData>(intl.formatMessage({ id: 'common.asset' })),
      btnColumn()
    ],
    [btnColumn, intl]
  )

  const renderTable = useCallback(
    (tableData: LoansTableRowsData, loading = false) => {
      const columns = isDesktopView ? desktopColumns : mobileColumns

      return (
        <>
          <Table
            columns={columns}
            dataSource={tableData}
            loading={loading}
            rowKey="key"
            onRow={({ asset }: LoansTableRowData) => {
              return {
                onClick: () => {
                  navigate(poolsRoutes.detail.path({ asset: assetToString(asset) }))
                }
              }
            }}
          />
        </>
      )
    },
    [desktopColumns, isDesktopView, mobileColumns, navigate]
  )

  return (
    <>
      {FP.pipe(
        sequenceTRD(poolsRD),
        RD.fold(
          // initial state
          () => renderTable([], true),
          // loading state
          () => {
            const pools = O.getOrElse(() => [] as LoansTableRowsData)(previousCollateral.current)
            return renderTable(pools, true)
          },
          // render error state
          Shared.renderTableError(intl.formatMessage({ id: 'common.refresh' }), refreshHandler),
          // success state
          ([pools]): JSX.Element => {
            const { poolDetails }: PoolsState | PoolStateMaya = pools
            // filter chain assets
            const poolDetailsFiltered: PoolDetails | PoolDetailsMaya = FP.pipe(
              poolDetails,
              A.filter(({ totalCollateral }) => Number(totalCollateral) > 0)
            )

            const poolViewData = getLoansTableRowsData({
              poolDetails: poolDetailsFiltered,
              pricePoolData: selectedPricePool.poolData,
              watchlist: poolWatchList,
              network
            })
            previousCollateral.current = O.some(poolViewData)
            return renderTable(poolViewData)
          }
        )
      )}
    </>
  )
}
