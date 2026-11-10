import clsx from 'clsx'
import { IntlShape, useIntl } from 'react-intl'

import { Tooltip } from '../../components/uielements/tooltip'
import { PoolStatus, PoolStatusKind } from '../../helpers/poolStatusHelper'

const LABEL_IDS = {
  chain: 'pools.status.chain',
  trading: 'pools.status.trading',
  lp: 'pools.status.lp',
  deposit: 'pools.status.deposit'
} as const satisfies Record<PoolStatusKind, string>

const INFO_IDS = {
  chain: 'pools.status.chain.info',
  trading: 'pools.status.trading.info',
  lp: 'pools.status.lp.info',
  deposit: 'pools.status.deposit.info'
} as const satisfies Record<PoolStatusKind, string>

/** Short label (`Trading halted`) and explanation of a pool status */
export const getPoolStatusMessages = (
  intl: IntlShape,
  { kind, outboundDelayed }: PoolStatus,
  chain: string
): { label: string; info: string } => {
  const info = intl.formatMessage({ id: INFO_IDS[kind] }, { chain })
  return {
    label: intl.formatMessage({ id: LABEL_IDS[kind] }),
    info: outboundDelayed ? `${info}\n${intl.formatMessage({ id: 'pools.status.outboundDelayed' }, { chain })}` : info
  }
}

/** Chain or trading halts are highlighted (amber), LP or deposit pauses are neutral (grey) */
export const isHaltStatus = ({ kind }: PoolStatus): boolean => kind === 'chain' || kind === 'trading'

type Props = {
  status: PoolStatus
  chain: string
  className?: string
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
          'inline-flex cursor-help items-center gap-1.5 rounded-full border px-2 py-1 font-main text-[11px] leading-none whitespace-nowrap',
          'border-gray0 bg-bg2 text-text2 dark:border-gray0d dark:bg-bg2d/40 dark:text-text2d',
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
