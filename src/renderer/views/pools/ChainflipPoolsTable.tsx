import { useMemo, useState } from 'react'

import { ChartBarIcon, ChevronDownIcon, ChevronUpIcon, StarIcon as StarOutlined } from '@heroicons/react/24/outline'
import { StarIcon as StarFilled } from '@heroicons/react/24/solid'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import BoostIcon from '../../assets/svg/boost.svg'
import { AssetIcon } from '../../components/uielements/assets/assetIcon'
import { Tooltip } from '../../components/uielements/tooltip'
import { distinctChainId } from '../../helpers/assetHelper'
import { ChainflipAssetRowData } from '../../services/chainflip/poolData.types'
import { FOCUS_RING, HEAD_CELL, PoolActionButton, SKELETON_ROWS } from './PoolsTable'

/** Chainflip asset row with the user's watchlist state */
export type ChainflipPoolsTableRow = ChainflipAssetRowData & { watched: boolean }

export type ChainflipSortKey = 'asset' | 'priceUSD'
export type ChainflipSort = { key: ChainflipSortKey; direction: 'asc' | 'desc' } | undefined

export const formatChainflipUsd = (amount: number | undefined): string => {
  if (amount === undefined) return '—'
  if (amount >= 1) return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
}

// Chainflip swap amounts can exceed Number.MAX_SAFE_INTEGER for 18-decimal
// tokens, so use BigNumber rather than `Number(amount) / 10**decimals`.
export const formatChainflipBaseUnits = (amount: string, decimals: number, symbol: string): string => {
  if (!amount) return '—'
  const value = new BigNumber(amount).shiftedBy(-decimals)
  if (!value.isFinite()) return '—'
  return `${value.decimalPlaces(6, BigNumber.ROUND_DOWN).toFormat()} ${symbol}`
}

/**
 * Sorts Chainflip rows. Without a sort the order of the Chainflip SDK is kept.
 * Assets sort by ticker, then chain. Rows without a price are always last.
 */
export const sortChainflipRows = <T extends ChainflipAssetRowData>(rows: T[], sort: ChainflipSort): T[] => {
  if (!sort) return rows
  const dir = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sort.key === 'priceUSD') {
      if (a.priceUSD === undefined || b.priceUSD === undefined)
        return a.priceUSD === b.priceUSD ? 0 : a.priceUSD === undefined ? 1 : -1
      return (a.priceUSD - b.priceUSD) * dir
    }
    return (a.asset.ticker.localeCompare(b.asset.ticker) || a.chain.localeCompare(b.chain)) * dir
  })
}

export type Props = {
  rows: ChainflipPoolsTableRow[]
  network: Network
  /** Initial load without any rows to show */
  loading?: boolean
  /** Message if there are no rows at all (not just none matching a filter) */
  emptyMessage?: string
  onSwap: (row: ChainflipAssetRowData) => void
  onDetail: (asset: AnyAsset) => void
  onWatch: (asset: AnyAsset) => void
  onUnwatch: (asset: AnyAsset) => void
  className?: string
}

// Columns are dropped by width of the table (container queries), not by width of the window
const HIDE_BELOW_640 = 'hidden @min-[640px]:table-cell'
const COLUMN_COUNT = 5

/**
 * Chainflip assets in the same layout as the THORChain / MAYAChain `PoolsTable`.
 * Shows only what Chainflip provides (price, minimum swap, boost); no depth, volume, APY or halt status.
 */
export const ChainflipPoolsTable = ({
  rows,
  network,
  loading = false,
  emptyMessage,
  onSwap,
  onDetail,
  onWatch,
  onUnwatch,
  className
}: Props): JSX.Element => {
  const intl = useIntl()
  const [sort, setSort] = useState<ChainflipSort>(undefined)

  const sortedRows = useMemo(() => sortChainflipRows(rows, sort), [rows, sort])

  const toggleSort = (key: ChainflipSortKey) =>
    setSort((current) => ({
      key,
      direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }))

  const renderSortHead = (key: ChainflipSortKey, label: string, headClassName: string) => {
    const sorted = sort?.key === key
    return (
      <th
        scope="col"
        aria-sort={sorted ? (sort?.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
        className={clsx(HEAD_CELL, headClassName)}>
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={clsx(
            'inline-flex items-center gap-1 rounded tracking-wider uppercase hover:text-text0 dark:hover:text-text0d',
            FOCUS_RING,
            sorted && 'text-text0 dark:text-text0d'
          )}>
          {label}
          {sorted && sort?.direction === 'asc' ? (
            <ChevronUpIcon className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronDownIcon className={clsx('h-3 w-3', !sorted && 'opacity-0')} aria-hidden />
          )}
        </button>
      </th>
    )
  }

  const nativeLabel = intl.formatMessage({ id: 'common.asset.native' })
  const swapLabel = intl.formatMessage({ id: 'common.swap' })
  const chartLabel = intl.formatMessage({ id: 'pools.chart' })
  const boostLabel = intl.formatMessage({ id: 'pools.chainflip.boostAvailable' })

  const renderRow = (row: ChainflipPoolsTableRow) => {
    const { asset, watched } = row
    const watchLabel = intl.formatMessage({ id: watched ? 'pools.watchlist.remove' : 'pools.watchlist.add' })
    return (
      <tr
        key={`${row.chain}.${asset.symbol}`}
        data-testid="chainflip-pools-table-row"
        className="group border-b border-gray0/50 last:border-0 hover:bg-bg2/70 dark:border-gray0d/50 dark:hover:bg-bg2d/40">
        <td className="w-10 pl-2">
          <button
            type="button"
            aria-label={watchLabel}
            aria-pressed={watched}
            title={watchLabel}
            onClick={() => (watched ? onUnwatch(asset) : onWatch(asset))}
            className={clsx(
              'flex items-center justify-center rounded p-1 text-gray1 hover:text-turquoise',
              FOCUS_RING
            )}>
            {watched ? (
              <StarFilled className="h-4 w-4 text-turquoise" aria-hidden />
            ) : (
              <StarOutlined className="h-4 w-4" aria-hidden />
            )}
          </button>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <AssetIcon asset={asset} size="small" network={network} />
            <div className="flex min-w-0 flex-col">
              <span className="font-main-semi-bold text-[14px] text-text0 dark:text-text0d">{asset.ticker}</span>
              <span className="font-main text-[11px] text-gray1 dark:text-gray1d">
                {distinctChainId(asset) ?? nativeLabel}
              </span>
            </div>
          </div>
        </td>
        <td className="px-3 text-right whitespace-nowrap text-text0 dark:text-text0d">
          {formatChainflipUsd(row.priceUSD)}
        </td>
        <td className={clsx('px-3 text-right whitespace-nowrap text-text2 dark:text-text2d', HIDE_BELOW_640)}>
          <div className="flex items-center justify-end gap-1.5">
            {formatChainflipBaseUnits(row.minSwapAmount, row.decimals, row.symbol)}
            {row.boostAvailable && (
              <Tooltip title={boostLabel} placement="top">
                <img src={BoostIcon} alt={boostLabel} className="h-4 w-4" data-testid="chainflip-boost" />
              </Tooltip>
            )}
          </div>
        </td>
        <td className="pr-3">
          <div className="flex items-center justify-end gap-1.5 opacity-70 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onDetail(asset)}
              aria-label={chartLabel}
              title={chartLabel}
              className={clsx(
                'hidden rounded-lg p-1.5 text-gray1 hover:bg-turquoise/10 hover:text-turquoise @min-[520px]:block',
                FOCUS_RING
              )}>
              <ChartBarIcon className="h-4 w-4" aria-hidden />
            </button>
            <PoolActionButton label={swapLabel} onClick={() => onSwap(row)} />
          </div>
        </td>
      </tr>
    )
  }

  const renderSkeleton = () =>
    Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <tr key={`skeleton-${index}`} className="border-b border-gray0/50 last:border-0 dark:border-gray0d/50">
        <td colSpan={COLUMN_COUNT} className="px-3 py-3.5">
          <div className="h-6 w-full animate-pulse rounded bg-bg2 dark:bg-bg2d/50" />
        </td>
      </tr>
    ))

  return (
    // `overflow-clip` (not `hidden`) keeps rounded corners without breaking the sticky header
    <div
      className={clsx(
        '@container w-full overflow-clip rounded-xl border border-gray0/70 bg-bg1 dark:border-gray0d dark:bg-bg1d',
        className
      )}>
      <table className="w-full border-collapse font-main text-[13px] tabular-nums" data-testid="chainflip-pools-table">
        <thead className="sticky -top-4 z-10 bg-bg1 lg:-top-8 dark:bg-bg1d">
          <tr className="border-b border-gray0/70 dark:border-gray0d">
            <th scope="col" className={clsx(HEAD_CELL, 'w-10')}>
              <span className="sr-only">{intl.formatMessage({ id: 'pools.watchlist' })}</span>
            </th>
            {renderSortHead('asset', intl.formatMessage({ id: 'common.asset' }), 'text-left')}
            {renderSortHead('priceUSD', intl.formatMessage({ id: 'common.price' }), 'text-right')}
            <th scope="col" className={clsx(HEAD_CELL, 'text-right', HIDE_BELOW_640)}>
              {intl.formatMessage({ id: 'pools.chainflip.minSwap' })}
            </th>
            <th scope="col" className={clsx(HEAD_CELL, 'w-[1%]')}>
              <span className="sr-only">{intl.formatMessage({ id: 'common.action' })}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.length > 0 ? (
            sortedRows.map(renderRow)
          ) : loading ? (
            renderSkeleton()
          ) : (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-3 py-10 text-center text-text2 dark:text-text2d">
                {emptyMessage ?? intl.formatMessage({ id: 'common.noResult' })}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
