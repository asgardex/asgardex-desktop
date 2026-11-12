import clsx from 'clsx'
import { IntlShape, useIntl } from 'react-intl'

import { Tooltip } from '../../components/uielements/tooltip'
import { PoolStatus, PoolStatusKind } from '../../helpers/poolStatusHelper'

const LABEL_IDS = {
  unknown: 'pools.status.unknown',
  chain: 'pools.status.chain',
  trading: 'pools.status.trading',
  lp: 'pools.status.lp',
  deposit: 'pools.status.deposit'
} as const satisfies Record<PoolStatusKind, string>

const INFO_IDS = {
  unknown: 'pools.status.unknown.info',
  chain: 'pools.status.chain.info',
  trading: 'pools.status.trading.info',
  lp: 'pools.status.lp.info',
  deposit: 'pools.status.deposit.info'
} as const satisfies Record<PoolStatusKind, string>

/** Short label (`Trading halted`) and explanation of a pool status */
export const getPoolStatusMessages = (
  intl: IntlShape,
  { kind }: PoolStatus,
  chain: string
): { label: string; info: string } => ({
  label: intl.formatMessage({ id: LABEL_IDS[kind] }),
  info: intl.formatMessage({ id: INFO_IDS[kind] }, { chain })
})

/** Chain or trading halts are highlighted (amber); LP / deposit pauses and an unknown status are neutral (grey) */
export const isHaltStatus = ({ kind }: PoolStatus): boolean => kind === 'chain' || kind === 'trading'

const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-main text-[11px] leading-none whitespace-nowrap border-gray0 bg-bg2 dark:border-gray0d dark:bg-bg2d/40'

type Props = {
  status: PoolStatus
  chain: string
  className?: string
}

/** Healthy pool: same chip shape as a limited status, so the column lines up. */
export const OperationalStatus = ({ className }: { className?: string }): JSX.Element => {
  const intl = useIntl()
  const label = intl.formatMessage({ id: 'pools.status.operational' })
  const info = intl.formatMessage({ id: 'pools.status.operational.info' })
  return (
    <Tooltip title={info} size="big">
      <span
        tabIndex={0}
        aria-label={`${label}. ${info}`}
        data-testid="pool-status-chip"
        data-status="operational"
        className={clsx(
          CHIP,
          'text-text2 dark:text-text2d',
          'focus-visible:ring-2 focus-visible:ring-turquoise focus-visible:outline-none',
          className
        )}>
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-turquoise" />
        {label}
      </span>
    </Tooltip>
  )
}

/**
 * Neutral chip to show a limited pool. Its tooltip (hover or keyboard focus) explains what is unavailable.
 */
export const PoolStatusChip = ({ status, chain, className }: Props): JSX.Element => {
  const intl = useIntl()
  const { label, info } = getPoolStatusMessages(intl, status, chain)
  return (
    <Tooltip title={info} size="big">
      <span
        tabIndex={0}
        aria-label={`${label}. ${info}`}
        data-testid="pool-status-chip"
        data-status={status.kind}
        className={clsx(
          CHIP,
          'cursor-help text-text2 dark:text-text2d',
          'focus-visible:ring-2 focus-visible:ring-turquoise focus-visible:outline-none',
          className
        )}>
        <span
          aria-hidden
          className={clsx(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            isHaltStatus(status) ? 'bg-warning0 dark:bg-warning0d' : 'bg-gray1 dark:bg-gray1d'
          )}
        />
        {label}
      </span>
    </Tooltip>
  )
}
