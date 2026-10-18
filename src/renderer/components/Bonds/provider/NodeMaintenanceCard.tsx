import { useIntl } from 'react-intl'

import { NodeInfo, NodeStatusEnum } from '../../../services/thorchain/types'
import { BorderButton, FlatButton } from '../../uielements/button'
import { MaintenanceTag } from './NodeStatusTag'

type Props = {
  node: NodeInfo
  onToggle: () => void
}

export const NodeMaintenanceCard = ({ node, onToggle }: Props) => {
  const intl = useIntl()
  const on = node.maintenance
  const isActive = node.status === NodeStatusEnum.Active

  return (
    <div className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
      <div className="flex items-center justify-between gap-3">
        <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.operator.maintenance.title' })}
        </span>
        {on ? (
          <MaintenanceTag />
        ) : (
          <span className="font-main-semi-bold text-[12px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.operator.maintenance.off' })}
          </span>
        )}
      </div>
      <span className="mt-4 font-main text-[15px] text-text0 dark:text-text0d">
        {intl.formatMessage({
          id: on ? 'bonds.operator.maintenance.onHeadline' : 'bonds.operator.maintenance.offHeadline'
        })}
      </span>
      <span className="mt-2 font-main text-[13px] leading-relaxed text-gray2 dark:text-gray2d">
        {intl.formatMessage({
          id: on
            ? isActive
              ? 'bonds.operator.maintenance.onActiveDesc'
              : 'bonds.operator.maintenance.onDesc'
            : 'bonds.operator.maintenance.offDesc'
        })}
      </span>
      <div className="mt-auto flex items-center justify-end border-t border-solid border-gray0 pt-4 dark:border-gray0d">
        {on ? (
          <FlatButton size="normal" onClick={onToggle}>
            {intl.formatMessage({ id: 'bonds.operator.maintenance.disable' })}
          </FlatButton>
        ) : (
          <BorderButton size="normal" color="warning" onClick={onToggle}>
            {intl.formatMessage({ id: 'bonds.operator.maintenance.enable' })}
          </BorderButton>
        )}
      </div>
    </div>
  )
}
