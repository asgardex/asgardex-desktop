import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { ColumnDef } from '@tanstack/react-table'
import { Network } from '@xchainjs/xchain-client'
import { assetToString } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetBTC } from '../../../shared/utils/asset'
import BoostIcon from '../../assets/svg/boost.svg'
import { AssetsFilter } from '../../components/AssetsFilter'
import { Table } from '../../components/table'
import { AssetData } from '../../components/uielements/assets/assetData'
import { TextButton } from '../../components/uielements/button'
import { Action as ActionButtonAction, ActionButton } from '../../components/uielements/button/ActionButton'
import { Label } from '../../components/uielements/label'
import { Tooltip } from '../../components/uielements/tooltip'
import { AssetUSDC, DEFAULT_WALLET_TYPE } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useChainflipContext } from '../../contexts/ChainflipContext'
import { eqAsset } from '../../helpers/fp/eq'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { usePoolFilter } from '../../hooks/usePoolFilter'
import { usePoolWatchlist } from '../../hooks/usePoolWatchlist'
import * as poolsRoutes from '../../routes/pools'
import { ChainflipAssetRowData } from '../../services/chainflip/poolData.types'
import { DEFAULT_NETWORK } from '../../services/const'
import { DEFAULT_POOL_FILTERS } from '../../services/midgard/midgardTypes'
import { FixmeType } from '../../types/asgardex'
import { filterTableData } from './Pools.utils'
import * as Shared from './PoolsOverview.shared'

// Chainflip asset row enriched with the user's watchlist state (favourites).
type ChainflipAssetRow = ChainflipAssetRowData & { watched: boolean }

const formatUsd = (amount: number | undefined): string => {
  if (amount === undefined) return '—'
  if (amount >= 1) return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
}

// Chainflip swap amounts can exceed Number.MAX_SAFE_INTEGER for 18-decimal
// tokens, so use BigNumber rather than `Number(amount) / 10**decimals`.
const formatBaseUnits = (amount: string, decimals: number, symbol: string): string => {
  if (!amount) return '—'
  const value = new BigNumber(amount).shiftedBy(-decimals)
  if (!value.isFinite()) return '—'
  return `${value.decimalPlaces(6, BigNumber.ROUND_DOWN).toFormat()} ${symbol}`
}

export const ChainflipAssets = (): JSX.Element => {
  const navigate = useNavigate()
  const intl = useIntl()
  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const { chainflipAssetRows$, reloadChainflipAssetRows } = useChainflipContext()
  const rowsRD = useObservableState(chainflipAssetRows$, RD.pending)
  const isLargeScreen = useBreakpoint()?.lg ?? false

  const { setFilter: setPoolFilter, filter: poolFilter } = usePoolFilter('active')
  const { add: addPoolToWatchlist, remove: removePoolFromWatchlist, list: poolWatchList } = usePoolWatchlist()

  const handleSwap = useCallback(
    (row: ChainflipAssetRowData) => {
      // Default target: USDC for non-USDC sources, BTC for USDC source
      const isUsdc = row.asset.ticker === 'USDC'
      const target = isUsdc ? AssetBTC : AssetUSDC
      navigate(
        poolsRoutes.swap.path({
          source: assetToString(row.asset),
          target: assetToString(target),
          sourceWalletType: DEFAULT_WALLET_TYPE,
          targetWalletType: DEFAULT_WALLET_TYPE
        })
      )
    },
    [navigate]
  )

  const columns: ColumnDef<ChainflipAssetRow, FixmeType>[] = useMemo(
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
        header: intl.formatMessage({ id: 'common.asset' }),
        cell: ({ row }) => (
          <div className="flex w-full items-center">
            <AssetData asset={row.original.asset} network={network} />
          </div>
        ),
        sortingFn: (a, b) => a.original.asset.symbol.localeCompare(b.original.asset.symbol)
      },
      {
        accessorKey: 'chain',
        header: intl.formatMessage({ id: 'common.chain' }),
        cell: ({ row }) => (
          <Label className="!text-16" align="left" nowrap>
            {row.original.chain}
          </Label>
        ),
        sortingFn: (a, b) => a.original.chain.localeCompare(b.original.chain)
      },
      {
        accessorKey: 'priceUSD',
        header: intl.formatMessage({ id: 'common.price' }),
        cell: ({ row }) => (
          <Label className="!text-16" align="right" nowrap>
            {formatUsd(row.original.priceUSD)}
          </Label>
        ),
        sortingFn: (a, b) => (a.original.priceUSD ?? 0) - (b.original.priceUSD ?? 0)
      },
      ...(isLargeScreen
        ? ([
            {
              accessorKey: 'minSwapAmount',
              header: intl.formatMessage({ id: 'pools.chainflip.minSwap' }),
              cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1.5">
                  <Label className="!text-16" align="right" nowrap>
                    {formatBaseUnits(row.original.minSwapAmount, row.original.decimals, row.original.symbol)}
                  </Label>
                  {row.original.boostAvailable && (
                    <Tooltip title={intl.formatMessage({ id: 'pools.chainflip.boostAvailable' })} placement="top">
                      <img src={BoostIcon} alt="Boost" className="h-4 w-4" />
                    </Tooltip>
                  )}
                </div>
              ),
              enableSorting: false
            }
          ] as ColumnDef<ChainflipAssetRow, FixmeType>[])
        : []),
      {
        accessorKey: 'actions',
        header: () => (
          <div className="flex items-center justify-center">
            <TextButton size={isLargeScreen ? 'normal' : 'large'} onClick={reloadChainflipAssetRows}>
              <div className="flex items-center">
                <ArrowPathIcon className={clsx('h-4 w-4', { 'mr-2': isLargeScreen })} />
                {isLargeScreen && intl.formatMessage({ id: 'common.refresh' })}
              </div>
            </TextButton>
          </div>
        ),
        cell: ({ row }) => {
          const { asset } = row.original
          const actions: ActionButtonAction[] = [
            {
              label: intl.formatMessage({ id: 'common.swap' }),
              callback: () => handleSwap(row.original)
            }
          ]
          return (
            <div className="flex items-center justify-center [&>*:not(:first-child)]:ml-10px">
              <button
                onClick={() => navigate(poolsRoutes.detail.path({ asset: assetToString(asset) }))}
                className="flex items-center justify-center rounded p-1 text-text2 transition-colors hover:text-turquoise dark:text-text2d dark:hover:text-turquoise"
                title={intl.formatMessage({ id: 'pools.chart' })}>
                <ChartBarIcon className="h-5 w-5" />
              </button>
              <ActionButton size="normal" actions={actions} />
            </div>
          )
        },
        enableSorting: false
      }
    ],
    [
      intl,
      network,
      isLargeScreen,
      handleSwap,
      navigate,
      addPoolToWatchlist,
      removePoolFromWatchlist,
      reloadChainflipAssetRows
    ]
  )

  const renderTable = useCallback(
    (data: ChainflipAssetRowData[], loading = false) => {
      const rows: ChainflipAssetRow[] = data.map((row) => ({
        ...row,
        watched: FP.pipe(
          poolWatchList,
          A.findFirst((asset) => eqAsset.equals(asset, row.asset)),
          O.isSome
        )
      }))
      const dataSource = FP.pipe(rows, filterTableData(poolFilter))

      return (
        <>
          <AssetsFilter
            className="mb-5"
            activeFilter={poolFilter}
            setFilter={setPoolFilter}
            poolFilters={DEFAULT_POOL_FILTERS}
          />
          {data.length === 0 && !loading ? (
            <div className="py-12 text-center text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'pools.chainflip.empty' })}
            </div>
          ) : (
            <Table columns={columns} data={dataSource} loading={loading} />
          )}
        </>
      )
    },
    [columns, intl, poolFilter, poolWatchList, setPoolFilter]
  )

  return (
    <>
      {RD.fold(
        () => renderTable([], true),
        () => renderTable([], true),
        Shared.renderTableError(intl.formatMessage({ id: 'common.refresh' }), reloadChainflipAssetRows),
        (data: ChainflipAssetRowData[]) => renderTable(data)
      )(rowsRD)}
    </>
  )
}
