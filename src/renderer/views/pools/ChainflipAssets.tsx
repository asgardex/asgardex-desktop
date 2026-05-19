import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ColumnDef } from '@tanstack/react-table'
import { Network } from '@xchainjs/xchain-client'
import { assetToString } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetBTC } from '../../../shared/utils/asset'
import { Table } from '../../components/table'
import { AssetData } from '../../components/uielements/assets/assetData'
import { TextButton } from '../../components/uielements/button'
import { Label } from '../../components/uielements/label'
import { AssetUSDC, DEFAULT_WALLET_TYPE } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useChainflipContext } from '../../contexts/ChainflipContext'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import * as poolsRoutes from '../../routes/pools'
import { ChainflipAssetRowData } from '../../services/chainflip/poolData.types'
import { DEFAULT_NETWORK } from '../../services/const'
import { FixmeType } from '../../types/asgardex'
import * as Shared from './PoolsOverview.shared'

const formatUsd = (amount: number | undefined): string => {
  if (amount === undefined) return '—'
  if (amount >= 1) return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
}

const formatBaseUnits = (amount: string | null, decimals: number, symbol: string): string => {
  if (!amount) return '—'
  const n = Number(amount) / Math.pow(10, decimals)
  if (!isFinite(n)) return '—'
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`
}

export const ChainflipAssets = (): JSX.Element => {
  const navigate = useNavigate()
  const intl = useIntl()
  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const { chainflipAssetRows$, reloadChainflipAssetRows } = useChainflipContext()
  const rowsRD = useObservableState(chainflipAssetRows$, RD.pending)
  const isLargeScreen = useBreakpoint()?.lg ?? false
  const isXLargeScreen = useBreakpoint()?.xl ?? false

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

  const columns: ColumnDef<ChainflipAssetRowData, FixmeType>[] = useMemo(
    () => [
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
      ...(isXLargeScreen
        ? ([
            {
              accessorKey: 'minSwapAmount',
              header: intl.formatMessage({ id: 'pools.chainflip.minSwap' }),
              cell: ({ row }) => (
                <Label className="!text-16" align="right" nowrap>
                  {formatBaseUnits(row.original.minSwapAmount, row.original.decimals, row.original.symbol)}
                </Label>
              ),
              enableSorting: false
            },
            {
              accessorKey: 'maxSwapAmount',
              header: intl.formatMessage({ id: 'pools.chainflip.maxSwap' }),
              cell: ({ row }) => (
                <Label className="!text-16" align="right" nowrap>
                  {formatBaseUnits(row.original.maxSwapAmount, row.original.decimals, row.original.symbol)}
                </Label>
              ),
              enableSorting: false
            }
          ] as ColumnDef<ChainflipAssetRowData, FixmeType>[])
        : []),
      ...(isLargeScreen
        ? ([
            {
              accessorKey: 'boostAvailable',
              header: intl.formatMessage({ id: 'pools.chainflip.boost' }),
              cell: ({ row }) => (
                <Label className="!text-16" align="center" nowrap>
                  {intl.formatMessage({
                    id: row.original.boostAvailable ? 'pools.chainflip.boostYes' : 'pools.chainflip.boostNo'
                  })}
                </Label>
              ),
              sortingFn: (a, b) => Number(b.original.boostAvailable) - Number(a.original.boostAvailable)
            }
          ] as ColumnDef<ChainflipAssetRowData, FixmeType>[])
        : []),
      {
        accessorKey: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <TextButton size="normal" onClick={() => handleSwap(row.original)}>
              {intl.formatMessage({ id: 'common.swap' })}
            </TextButton>
          </div>
        ),
        enableSorting: false
      }
    ],
    [intl, network, isLargeScreen, isXLargeScreen, handleSwap]
  )

  const renderTable = useCallback(
    (data: ChainflipAssetRowData[], loading = false) => (
      <>
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-solid border-gray0 bg-bg0 p-3 dark:border-gray0d dark:bg-bg0d">
          <div className="flex flex-col">
            <Label size="big" weight="bold" textTransform="uppercase">
              {intl.formatMessage({ id: 'pools.chainflip.title' })}
            </Label>
            <span className="mt-1 text-sm text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'pools.chainflip.disclaimer' })}
            </span>
          </div>
        </div>
        {data.length === 0 && !loading ? (
          <div className="py-12 text-center text-text2 dark:text-text2d">
            {intl.formatMessage({ id: 'pools.chainflip.empty' })}
          </div>
        ) : (
          <Table columns={columns} data={data} loading={loading} />
        )}
      </>
    ),
    [columns, intl]
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
