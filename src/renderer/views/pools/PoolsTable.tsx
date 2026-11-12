import { useMemo, useState } from 'react'

import { ChartBarIcon, ChevronDownIcon, ChevronUpIcon, StarIcon as StarOutlined } from '@heroicons/react/24/outline'
import { StarIcon as StarFilled } from '@heroicons/react/24/solid'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetIcon } from '../../components/uielements/assets/assetIcon'
import { Tooltip } from '../../components/uielements/tooltip'
import { distinctChainId } from '../../helpers/assetHelper'
import { isAddDisabled, isSwapDisabled, PoolStatus } from '../../helpers/poolStatusHelper'
import { DEFAULT_POOLS_SORT, PoolTableRowData, PoolsSort, PoolsSortKey } from './Pools.types'
import { formatCompactAmount, formatPoolApy, formatPoolPrice, sortPoolRows } from './Pools.utils'
import { getPoolStatusMessages, OperationalStatus, PoolStatusChip } from './PoolStatusChip'

export type PoolsTableRow = PoolTableRowData & {
  /** Limits of pool actions (halt, pause), `undefined` if all actions are available */
  poolStatus?: PoolStatus
}

export type PoolsTableVariant = 'active' | 'pending'

export type Props = {
  variant: PoolsTableVariant
  rows: PoolsTableRow[]
  /** Asset used to price all values (`$`, `ᚱ`, ...) */
  pricePoolAsset: AnyAsset
  network: Network
  /** Initial load without any rows to show */
  loading?: boolean
  /** Label of the APY period, e.g. `30D` (active pools only) */
  apyPeriodLabel?: string
  /** Blocks left until a pending pool can become active (pending pools only) */
  getBlocksLeft?: (row: PoolsTableRow) => string
  onSwap?: (asset: AnyAsset) => void
  onAdd: (asset: AnyAsset) => void
  onDetail?: (asset: AnyAsset) => void
  onWatch: (asset: AnyAsset) => void
  onUnwatch: (asset: AnyAsset) => void
  className?: string
}

// Columns are dropped by width of the table (container queries), not by width of the window
const HIDE_BELOW_640 = 'hidden @min-[640px]:table-cell'
const HIDE_BELOW_860 = 'hidden @min-[860px]:table-cell'

export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turquoise'

export const HEAD_CELL =
  'whitespace-nowrap px-3 py-2.5 font-main text-[11px] font-normal uppercase tracking-wider text-gray2 dark:text-gray2d'

export const SKELETON_ROWS = 8

/** Swap / Add button of a pool row; disabled with a reason that stays readable by keyboard */
export const PoolActionButton = ({
  label,
  onClick,
  disabledReason
}: {
  label: string
  onClick: () => void
  disabledReason?: string
}): JSX.Element => {
  const disabled = !!disabledReason
  const button = (
    <button
      type="button"
      // `aria-disabled` instead of `disabled` keeps the button focusable to read the reason by keyboard
      aria-disabled={disabled}
      aria-label={disabled ? `${label}: ${disabledReason}` : label}
      onClick={(event) => {
        event.stopPropagation()
        if (!disabled) onClick()
      }}
      className={clsx(
        'inline-flex h-8 min-w-[56px] items-center justify-center rounded-lg border px-3 font-main-semi-bold text-[12px] transition-colors',
        FOCUS_RING,
        disabled
          ? 'cursor-not-allowed border-gray0 text-gray1 dark:border-gray0d dark:text-gray1d'
          : 'border-turquoise/30 text-turquoise hover:border-turquoise hover:bg-turquoise/10'
      )}>
      {label}
    </button>
  )
  return disabledReason ? (
    <Tooltip title={disabledReason} size="big">
      {button}
    </Tooltip>
  ) : (
    button
  )
}

/**
 * Table of THORChain or MAYAChain pools (available or pending).
 * Specific to the pools page; columns are sortable and narrow tables drop less important columns.
 */
export const PoolsTable = ({
  variant,
  rows,
  pricePoolAsset,
  network,
  loading = false,
  apyPeriodLabel = '',
  getBlocksLeft = () => '--',
  onSwap,
  onAdd,
  onDetail,
  onWatch,
  onUnwatch,
  className
}: Props): JSX.Element => {
  const intl = useIntl()
  const [sort, setSort] = useState<PoolsSort>(DEFAULT_POOLS_SORT)
  const isActive = variant === 'active'

  const sortedRows = useMemo(() => sortPoolRows(rows, sort), [rows, sort])

  const toggleSort = (key: PoolsSortKey) =>
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }))

  const renderSortHead = (key: PoolsSortKey, label: string, className: string) => {
    const sorted = sort.key === key
    return (
      <th
        scope="col"
        aria-sort={sorted ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
        className={clsx(HEAD_CELL, className)}>
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={clsx(
            'inline-flex items-center gap-1 rounded tracking-wider uppercase hover:text-text0 dark:hover:text-text0d',
            FOCUS_RING,
            sorted && 'text-text0 dark:text-text0d'
          )}>
          {label}
          {sorted && sort.direction === 'asc' ? (
            <ChevronUpIcon className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronDownIcon className={clsx('h-3 w-3', !sorted && 'opacity-0')} aria-hidden />
          )}
        </button>
      </th>
    )
  }

  const columnCount = isActive ? 8 : 7
  const nativeLabel = intl.formatMessage({ id: 'common.asset.native' })

  const renderRow = (row: PoolsTableRow) => {
    const { asset, poolStatus: status, watched } = row
    const statusInfo = status ? getPoolStatusMessages(intl, status, asset.chain).info : undefined
    const swapLabel = intl.formatMessage({ id: 'common.swap' })
    const addLabel = intl.formatMessage({ id: 'common.add' })
    const watchLabel = intl.formatMessage({ id: watched ? 'pools.watchlist.remove' : 'pools.watchlist.add' })
    return (
      <tr
        key={`${asset.chain}.${asset.symbol}`}
        data-testid="pools-table-row"
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
        <td className="px-3 whitespace-nowrap">
          {status ? <PoolStatusChip status={status} chain={asset.chain} /> : <OperationalStatus />}
        </td>
        <td className="px-3 text-right whitespace-nowrap text-text0 dark:text-text0d">
          {formatPoolPrice(row.poolPrice, pricePoolAsset)}
        </td>
        <td className={clsx('px-3 text-right whitespace-nowrap text-text0 dark:text-text0d', HIDE_BELOW_640)}>
          {formatCompactAmount(row.depthPrice, pricePoolAsset)}
        </td>
        {isActive ? (
          <>
            <td className={clsx('px-3 text-right whitespace-nowrap text-text2 dark:text-text2d', HIDE_BELOW_860)}>
              {formatCompactAmount(row.volumePrice, pricePoolAsset)}
            </td>
            <td className="px-3 text-right font-main-semi-bold whitespace-nowrap text-text0 dark:text-text0d">
              {formatPoolApy(row.apy)}
            </td>
          </>
        ) : (
          <td className="px-3 text-right whitespace-nowrap text-text0 dark:text-text0d">{getBlocksLeft(row)}</td>
        )}
        <td className="pr-3">
          <div className="flex items-center justify-end gap-1.5 opacity-70 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            {isActive && onDetail && (
              <button
                type="button"
                onClick={() => onDetail(asset)}
                aria-label={intl.formatMessage({ id: 'pools.chart' })}
                title={intl.formatMessage({ id: 'pools.chart' })}
                className={clsx(
                  'hidden rounded-lg p-1.5 text-gray1 hover:bg-turquoise/10 hover:text-turquoise @min-[520px]:block',
                  FOCUS_RING
                )}>
                <ChartBarIcon className="h-4 w-4" aria-hidden />
              </button>
            )}
            {isActive && onSwap && (
              <PoolActionButton
                label={swapLabel}
                onClick={() => onSwap(asset)}
                disabledReason={isSwapDisabled(status) ? statusInfo : undefined}
              />
            )}
            <PoolActionButton
              label={addLabel}
              onClick={() => onAdd(asset)}
              disabledReason={isAddDisabled(status) ? statusInfo : undefined}
            />
          </div>
        </td>
      </tr>
    )
  }

  const renderSkeleton = () =>
    Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <tr key={`skeleton-${index}`} className="border-b border-gray0/50 last:border-0 dark:border-gray0d/50">
        <td colSpan={columnCount} className="px-3 py-3.5">
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
      <table
        className="w-full border-collapse font-main text-[13px] tabular-nums"
        data-testid={`pools-table-${variant}`}>
        {/* Sticky on <thead> (not <th>): Chrome lets rows paint through sticky cells of collapsed-border tables.
            The negative offset matches the app's scroll container padding (p-4 / lg:py-8) so the header pins flush to its top edge. */}
        <thead className="sticky -top-4 z-10 bg-bg1 lg:-top-8 dark:bg-bg1d">
          <tr className="border-b border-gray0/70 dark:border-gray0d">
            <th scope="col" className={clsx(HEAD_CELL, 'w-10')}>
              <span className="sr-only">{intl.formatMessage({ id: 'pools.watchlist' })}</span>
            </th>
            {renderSortHead('asset', intl.formatMessage({ id: 'common.pool' }), 'text-left')}
            {/* text-left: a th is centered by default, which left the label floating over a left-aligned cell.
                w-[1%] keeps the column as wide as its chip instead of stretching between Pool and Price. */}
            <th scope="col" className={clsx(HEAD_CELL, 'w-[1%] text-left')}>
              {intl.formatMessage({ id: 'common.status' })}
            </th>
            {renderSortHead('poolPrice', intl.formatMessage({ id: 'common.price' }), 'text-right')}
            {renderSortHead(
              'depthPrice',
              intl.formatMessage({ id: 'common.liquidity' }),
              clsx('text-right', HIDE_BELOW_640)
            )}
            {isActive ? (
              <>
                {renderSortHead(
                  'volumePrice',
                  intl.formatMessage({ id: 'pools.24hvol' }),
                  clsx('text-right', HIDE_BELOW_860)
                )}
                {renderSortHead(
                  'apy',
                  `${intl.formatMessage({ id: 'pools.apy' })} ${apyPeriodLabel}`.trim(),
                  'text-right'
                )}
              </>
            ) : (
              <th scope="col" className={clsx(HEAD_CELL, 'text-right')}>
                {intl.formatMessage({ id: 'pools.blocksleft' })}
              </th>
            )}
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
              <td colSpan={columnCount} className="px-3 py-10 text-center text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'common.noResult' })}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
