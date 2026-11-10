import { ChangeEvent } from 'react'

import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { PoolsPeriodSelector } from '../../components/uielements/pools/PoolsPeriodSelector'
import { emptyString } from '../../helpers/stringHelper'
import {
  GetPoolsPeriodEnum,
  isStaticPoolFilter,
  PoolFilter,
  PoolFilters,
  StaticPoolFilter
} from '../../services/midgard/midgardTypes'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turquoise'

export type Props = {
  poolFilters: PoolFilters
  /** Static filter (`__usd__`, ...) or search text, `none` for all pools */
  activeFilter: O.Option<PoolFilter>
  setFilter: (filter: O.Option<PoolFilter>) => void
  /** APY period - selector is hidden if not set */
  period?: GetPoolsPeriodEnum
  onChangePeriod?: (period: GetPoolsPeriodEnum) => void
  refreshing: boolean
  onRefresh: () => void
  className?: string
}

/**
 * Filters (segmented control), search, APY period and refresh of the pools page.
 * Static filter and search text are exclusive (same as `AssetsFilter`), so both are stored as one `PoolFilter`.
 */
export const PoolsToolbar = ({
  poolFilters,
  activeFilter,
  setFilter,
  period,
  onChangePeriod,
  refreshing,
  onRefresh,
  className
}: Props): JSX.Element => {
  const intl = useIntl()

  const labels: Record<StaticPoolFilter, string> = {
    __watched__: intl.formatMessage({ id: 'pools.watchlist' }),
    __native__: intl.formatMessage({ id: 'common.asset.native' }),
    __usd__: intl.formatMessage({ id: 'pools.filter.stablecoins' }),
    __erc20__: 'ERC20',
    __avax__: 'AVAX',
    __base__: 'BASE',
    __arb__: 'ARB',
    __synth__: 'Synth'
  }

  const staticFilter: O.Option<StaticPoolFilter> = FP.pipe(activeFilter, O.filter(isStaticPoolFilter))
  const searchValue: string = FP.pipe(
    activeFilter,
    O.filter((filter) => !isStaticPoolFilter(filter)),
    O.getOrElse(() => emptyString)
  )

  const segments: Array<{ filter: O.Option<StaticPoolFilter>; label: string }> = [
    { filter: O.none, label: intl.formatMessage({ id: 'common.all' }) },
    ...poolFilters.filter(isStaticPoolFilter).map((filter) => ({ filter: O.some(filter), label: labels[filter] }))
  ]

  const isSelected = (filter: O.Option<StaticPoolFilter>) =>
    O.isNone(filter) ? O.isNone(activeFilter) : O.getEq({ equals: (a, b) => a === b }).equals(filter, staticFilter)

  const refreshLabel = intl.formatMessage({ id: 'common.refresh' })

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      <div
        role="radiogroup"
        aria-label={intl.formatMessage({ id: 'common.filter' })}
        className="flex flex-wrap items-center gap-1 rounded-lg bg-bg2 p-1 dark:bg-bg2d/50">
        {segments.map(({ filter, label }) => {
          const selected = isSelected(filter)
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setFilter(filter)}
              className={clsx(
                'rounded-md px-2.5 py-1 font-main text-[12px] transition-colors',
                FOCUS_RING,
                selected
                  ? 'bg-bg0 text-text0 shadow-sm dark:bg-bg2d dark:text-text0d'
                  : 'text-text2 hover:text-text0 dark:text-text2d dark:hover:text-text0d'
              )}>
              {label}
            </button>
          )
        })}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="relative flex items-center">
          <span className="sr-only">{intl.formatMessage({ id: 'pools.search' })}</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 h-4 w-4 text-gray1" aria-hidden />
          <input
            type="search"
            value={searchValue}
            onChange={({ target }: ChangeEvent<HTMLInputElement>) =>
              setFilter(O.fromPredicate((value: string) => !!value)(target.value))
            }
            placeholder={intl.formatMessage({ id: 'pools.search' })}
            className={clsx(
              'h-8 w-48 rounded-lg border border-gray0 bg-bg0 pr-2 pl-8 font-main text-[13px] text-text0 placeholder:text-gray1',
              'focus:border-turquoise focus:outline-none dark:border-gray0d dark:bg-bg0d dark:text-text0d'
            )}
          />
        </label>
        {period && onChangePeriod && <PoolsPeriodSelector selectedValue={period} onChange={onChangePeriod} />}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label={refreshLabel}
          title={refreshLabel}
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-lg border border-gray0 text-text2 transition-colors hover:text-turquoise dark:border-gray0d dark:text-text2d',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-text2',
            FOCUS_RING
          )}>
          <ArrowPathIcon className={clsx('h-4 w-4', refreshing && 'animate-spin')} aria-hidden />
        </button>
      </div>
    </div>
  )
}
