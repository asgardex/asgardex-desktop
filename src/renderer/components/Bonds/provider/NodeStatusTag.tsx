import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { NodeStatusEnum } from '../../../services/thorchain/types'

const statusMessageId = (status: NodeStatusEnum) => {
  switch (status) {
    case NodeStatusEnum.Active:
      return 'bonds.status.active'
    case NodeStatusEnum.Ready:
      return 'bonds.status.ready'
    case NodeStatusEnum.Standby:
      return 'bonds.status.standby'
    case NodeStatusEnum.Disabled:
      return 'bonds.status.disabled'
    case NodeStatusEnum.Whitelisted:
      return 'bonds.status.whitelisted'
    default:
      return 'bonds.status'
  }
}

type Props = {
  status: NodeStatusEnum
  leaving?: boolean
  className?: string
}

export const NodeStatusTag = ({ status, leaving = false, className }: Props) => {
  const intl = useIntl()

  if (leaving) {
    return (
      <span
        className={clsx(
          'font-main-semi-bold text-[12px] tracking-[1px] text-gray2 uppercase dark:text-gray2d',
          className
        )}>
        {intl.formatMessage({ id: 'bonds.status.leaving' })}
      </span>
    )
  }

  return (
    <span
      className={clsx(
        'font-main-semi-bold text-[12px] tracking-[1px] uppercase',
        status === NodeStatusEnum.Active && 'text-turquoise',
        status === NodeStatusEnum.Standby && 'text-warning0 dark:text-warning0d',
        status === NodeStatusEnum.Disabled && 'text-error0 dark:text-error0d',
        (status === NodeStatusEnum.Ready || status === NodeStatusEnum.Whitelisted) && 'text-gray2 dark:text-gray2d',
        className
      )}>
      {intl.formatMessage({ id: statusMessageId(status) })}
    </span>
  )
}

export const MaintenanceTag = ({ className }: { className?: string }) => {
  const intl = useIntl()
  return (
    <span
      className={clsx(
        'rounded-sm bg-warning0/15 px-1.5 py-[1px] font-main-semi-bold text-[10px] tracking-[1px] text-warning0 uppercase dark:bg-warning0d/15 dark:text-warning0d',
        className
      )}>
      {intl.formatMessage({ id: 'bonds.operator.maintenance.tag' })}
    </span>
  )
}
