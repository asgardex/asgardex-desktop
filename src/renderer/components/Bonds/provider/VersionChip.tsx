import { useMemo } from 'react'

import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { NodeInfo } from '../../../services/thorchain/types'
import { Tooltip } from '../../uielements/tooltip'
import { bareVersion, versionTooltipMessage } from './nodeHealthMessages'
import { NodeNetworkContext, VersionLevel, versionState } from './nodeNetwork'

type Props = {
  node: NodeInfo
  ctx: O.Option<NodeNetworkContext>
  className?: string
}

const LEVEL_CLASSES: Record<VersionLevel, string> = {
  below: 'bg-error0/10 text-error0 dark:bg-error0d/15 dark:text-error0d',
  behind: 'bg-warning0/15 text-warning0 dark:bg-warning0d/15 dark:text-warning0d',
  current: 'text-gray2 dark:text-gray2d'
}

export const VersionChip = ({ node, ctx, className }: Props) => {
  const intl = useIntl()

  const oState = useMemo(
    () =>
      FP.pipe(
        ctx,
        O.chain(({ nodes, constants, version, currentHeight }) =>
          FP.pipe(
            O.fromNullable(version),
            O.map((version) => versionState(node, version, nodes, constants, currentHeight))
          )
        )
      ),
    [ctx, node]
  )

  const version = bareVersion(node.version)
  if (!version) return null

  const chip = (level: VersionLevel) => (
    <span
      className={clsx(
        'rounded-sm px-1.5 py-[1px] font-main-semi-bold text-[11px] leading-4 tracking-[0.5px] whitespace-nowrap',
        LEVEL_CLASSES[level],
        className
      )}>
      v{version}
    </span>
  )

  return FP.pipe(
    oState,
    O.fold(
      () => chip('current'),
      (state) => (
        <Tooltip size="big" title={versionTooltipMessage(state, node, intl)}>
          {chip(state.level)}
        </Tooltip>
      )
    )
  )
}
