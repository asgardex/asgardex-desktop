import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, baseAmount, BaseAmount, baseToAsset, Chain, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetCacao, AssetRuneNative, THORChain } from '../../../shared/utils/chainIds'
import { Tooltip } from '../../components/uielements/tooltip'
import { IncentivePendulumRD } from '../../hooks/useIncentivePendulum'
import { useLastSuccessRD } from '../../hooks/useLastSuccess'
import { formatCompactAmount } from './Pools.utils'
import { PoolsTableRow, PoolsTableVariant } from './PoolsTable'

export type Props = {
  variant: PoolsTableVariant
  rows: PoolsTableRow[]
  pricePoolAsset: AnyAsset
  protocol: Chain
  incentivePendulum: IncentivePendulumRD
  /** Blocks left until the next pending pool can become active (pending pools only) */
  nextPoolBlocksLeft?: string
  /** Initial load without any rows to show */
  loading?: boolean
  className?: string
}

const PENDULUM_COLOR = {
  green: 'bg-turquoise',
  yellow: 'bg-warning0 dark:bg-warning0d',
  red: 'bg-error0 dark:bg-error0d',
  grey: 'bg-gray1 dark:bg-gray1d'
} as const

const Tile = ({
  label,
  value,
  hint,
  indicator
}: {
  label: string
  value: string
  hint?: string
  indicator?: string
}): JSX.Element => (
  <div className="flex min-w-[150px] flex-1 flex-col gap-1 rounded-xl border border-gray0/70 bg-bg1 px-4 py-3 dark:border-gray0d dark:bg-bg1d">
    <span className="font-main text-[11px] tracking-wider text-gray2 uppercase dark:text-gray2d">{label}</span>
    <span className="flex items-center gap-2 truncate font-main-semi-bold text-[18px] text-text0 tabular-nums dark:text-text0d">
      {indicator && <span aria-hidden className={clsx('h-2 w-2 shrink-0 rounded-full', indicator)} />}
      {value}
    </span>
    <span className="min-h-4 truncate font-main text-[11px] text-gray1 dark:text-gray1d">{hint}</span>
  </div>
)

const sum = (amounts: BaseAmount[]): BaseAmount =>
  amounts.reduce((acc, amount) => acc.plus(amount), baseAmount(0, amounts[0]?.decimal))

/**
 * Summary tiles of the pools page: liquidity, 24h volume (or next pending pool), Incentive Pendulum and pool status.
 */
export const PoolsSummary = ({
  variant,
  rows,
  pricePoolAsset,
  protocol,
  incentivePendulum: incentivePendulumPropRD,
  nextPoolBlocksLeft = '--',
  loading = false,
  className
}: Props): JSX.Element => {
  const intl = useIntl()
  // Keep the last value while reloading. Note: use `key={protocol}` in parent to not keep values of another protocol
  const incentivePendulumRD = useLastSuccessRD(incentivePendulumPropRD)
  const empty = '--'
  const hasRows = rows.length > 0 || !loading

  const liquidity = sum(rows.map(({ depthPrice }) => depthPrice))
  const volume = sum(rows.map(({ volumePrice }) => volumePrice))
  const liquidityValue = baseToAsset(liquidity).amount()
  const volumeShare = liquidityValue.gt(0)
    ? baseToAsset(volume).amount().div(liquidityValue).times(100).toFixed(1)
    : '0.0'
  const limitedCount = rows.filter(({ poolStatus }) => poolStatus !== undefined).length
  // Halt data is per protocol: if one pool's status is unknown, all are
  const statusUnknown = rows.some(({ poolStatus }) => poolStatus?.kind === 'unknown')

  const protocolAsset = protocol === THORChain ? AssetRuneNative : AssetCacao

  const pendulumTile = RD.isSuccess(incentivePendulumRD) ? (
    <Tooltip
      size="big"
      title={intl.formatMessage(
        { id: 'pools.incentivependulum.tooltip' },
        {
          pooled: formatAssetAmountCurrency({
            amount: baseToAsset(incentivePendulumRD.value.totalPooledRuneAmount),
            asset: protocolAsset,
            decimal: 0
          }),
          bonded: formatAssetAmountCurrency({
            amount: baseToAsset(incentivePendulumRD.value.totalActiveBondAmount),
            asset: protocolAsset,
            decimal: 0
          })
        }
      )}>
      <div
        tabIndex={0}
        className="flex w-full rounded-xl focus-visible:ring-2 focus-visible:ring-turquoise focus-visible:outline-none">
        <Tile
          label={intl.formatMessage({ id: 'pools.incentivependulum.title' })}
          value={`${incentivePendulumRD.value.incentivePendulum}%`}
          indicator={PENDULUM_COLOR[incentivePendulumRD.value.incentivePendulumLight]}
        />
      </div>
    </Tooltip>
  ) : (
    <Tile
      label={intl.formatMessage({ id: 'pools.incentivependulum.title' })}
      value={empty}
      hint={RD.isFailure(incentivePendulumRD) ? intl.formatMessage({ id: 'pools.incentivependulum.error' }) : undefined}
    />
  )

  return (
    <div className={clsx('grid grid-cols-2 gap-3 lg:grid-cols-4', className)} data-testid="pools-summary">
      <Tile
        label={intl.formatMessage({ id: 'pools.summary.liquidity' })}
        value={hasRows ? formatCompactAmount(liquidity, pricePoolAsset) : empty}
        hint={hasRows ? intl.formatMessage({ id: 'pools.summary.pools' }, { count: rows.length }) : undefined}
      />
      {variant === 'active' ? (
        <Tile
          label={intl.formatMessage({ id: 'pools.24hvol' })}
          value={hasRows ? formatCompactAmount(volume, pricePoolAsset) : empty}
          hint={hasRows ? intl.formatMessage({ id: 'pools.summary.volumeShare' }, { percent: volumeShare }) : undefined}
        />
      ) : (
        <Tile
          label={intl.formatMessage({ id: 'pools.summary.nextPool' })}
          value={nextPoolBlocksLeft}
          hint={intl.formatMessage({ id: 'pools.blocksleft' })}
        />
      )}
      {pendulumTile}
      <Tile
        label={intl.formatMessage({ id: 'pools.summary.status' })}
        value={
          !hasRows
            ? empty
            : statusUnknown
              ? intl.formatMessage({ id: 'pools.status.unknown' })
              : limitedCount > 0
                ? intl.formatMessage({ id: 'pools.summary.limited' }, { count: limitedCount })
                : intl.formatMessage({ id: 'pools.summary.operational' })
        }
        hint={
          statusUnknown
            ? intl.formatMessage({ id: 'pools.summary.unknown.hint' })
            : limitedCount > 0
              ? intl.formatMessage({ id: 'pools.summary.limited.hint' })
              : undefined
        }
      />
    </div>
  )
}
