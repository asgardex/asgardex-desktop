import { useMemo } from 'react'

import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { NodeInfo } from '../../../services/thorchain/types'
import { Tooltip } from '../../uielements/tooltip'
import { healthLevelMessage, healthReasonMessage } from './nodeHealthMessages'
import { HealthLevel, NodeHealth, NodeNetworkContext, nodeHealth } from './nodeNetwork'

export const HEALTH_TAG_MAX_REASONS = 3
export const HEALTH_REASON_SEPARATOR = '\n'

export const HEALTH_DOT_CLASSES: Record<HealthLevel, string> = {
  healthy: 'bg-turquoise',
  attention: 'bg-warning0 dark:bg-warning0d',
  risk: 'bg-error0 dark:bg-error0d'
}

export const HEALTH_TEXT_CLASSES: Record<HealthLevel, string> = {
  healthy: 'text-gray2 dark:text-gray2d',
  attention: 'text-warning0 dark:text-warning0d',
  risk: 'text-error0 dark:text-error0d'
}

export const useNodeHealth = (node: NodeInfo, ctx: O.Option<NodeNetworkContext>): O.Option<NodeHealth> =>
  useMemo(
    () =>
      FP.pipe(
        ctx,
        O.map((context) => nodeHealth(node, context))
      ),
    [ctx, node]
  )

export const HealthLight = ({ level, className }: { level: HealthLevel; className?: string }) => {
  const intl = useIntl()
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-main-semi-bold text-[12px] tracking-[1px] whitespace-nowrap uppercase',
        HEALTH_TEXT_CLASSES[level],
        className
      )}>
      <span className={clsx('inline-block h-2 w-2 rounded-full', HEALTH_DOT_CLASSES[level])} />
      {healthLevelMessage(level, intl)}
    </span>
  )
}

type Props = {
  node: NodeInfo
  ctx: O.Option<NodeNetworkContext>
  className?: string
}

export const NodeHealthTag = ({ node, ctx, className }: Props) => {
  const intl = useIntl()
  const oHealth = useNodeHealth(node, ctx)

  return FP.pipe(
    oHealth,
    O.fold(
      () => null,
      ({ level, reasons }) => {
        const lines =
          reasons.length > 0
            ? reasons.slice(0, HEALTH_TAG_MAX_REASONS).map((reason) => healthReasonMessage(reason, intl, node))
            : [intl.formatMessage({ id: 'bonds.health.allClear' })]
        return (
          <Tooltip size="big" title={lines.join(HEALTH_REASON_SEPARATOR)}>
            <HealthLight level={level} className={className} />
          </Tooltip>
        )
      }
    )
  )
}
