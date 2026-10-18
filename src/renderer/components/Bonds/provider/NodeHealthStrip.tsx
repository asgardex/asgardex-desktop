import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { NodeInfo } from '../../../services/thorchain/types'
import { Tooltip } from '../../uielements/tooltip'
import { healthReasonMessage } from './nodeHealthMessages'
import { HEALTH_REASON_SEPARATOR, HEALTH_TEXT_CLASSES, HealthLight, useNodeHealth } from './NodeHealthTag'
import { NodeNetworkContext } from './nodeNetwork'
import { VersionChip } from './VersionChip'

type Props = {
  node: NodeInfo
  ctx: O.Option<NodeNetworkContext>
}

export const NodeHealthStrip = ({ node, ctx }: Props) => {
  const intl = useIntl()
  const oHealth = useNodeHealth(node, ctx)

  return FP.pipe(
    oHealth,
    O.fold(
      () => null,
      ({ level, reasons }) => {
        const [main, ...rest] = reasons.map((reason) => healthReasonMessage(reason, intl, node))
        return (
          <div className="mt-6 flex w-full flex-col rounded-lg border border-solid border-gray0 bg-bg0 px-6 py-4 dark:border-gray0d dark:bg-bg0d">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
                {intl.formatMessage({ id: 'bonds.health.title' })}
              </span>
              <HealthLight level={level} />
              <span
                className={clsx(
                  'font-main text-[13px]',
                  level === 'healthy' ? 'text-text0 dark:text-text0d' : HEALTH_TEXT_CLASSES[level]
                )}>
                {main ?? intl.formatMessage({ id: 'bonds.health.allClear' })}
              </span>
              {rest.length > 0 && (
                <Tooltip size="big" title={rest.join(HEALTH_REASON_SEPARATOR)}>
                  <span className="cursor-default font-main-semi-bold text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
                    {intl.formatMessage({ id: 'bonds.health.more' }, { count: rest.length })}
                  </span>
                </Tooltip>
              )}
              <div className="ml-auto flex items-center">
                <VersionChip node={node} ctx={ctx} />
              </div>
            </div>
          </div>
        )
      }
    )
  )
}
