import { Network } from '@xchainjs/xchain-client'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { hiddenString } from '../../../helpers/stringHelper'
import { NodeInfo, NodeStatusEnum } from '../../../services/thorchain/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BorderButton } from '../../uielements/button'
import { formatRuneAmount, isLeaveLocked, isNodeLeaving, operatorBond } from './helpers'

type Props = {
  network: Network
  isPrivate: boolean
  node: NodeInfo
  onLeave: () => void
}

export const NodeLeaveCard = ({ network, isPrivate, node, onLeave }: Props) => {
  const intl = useIntl()
  const isActive = node.status === NodeStatusEnum.Active
  const leaving = isNodeLeaving(node)
  const leaveLocked = isLeaveLocked(node)
  const headlineId = leaving
    ? 'bonds.operator.leave.requestedHeadline'
    : isActive
      ? 'bonds.operator.leave.headline'
      : 'bonds.operator.leave.standbyHeadline'
  const descId = leaving
    ? 'bonds.operator.leave.requestedDesc'
    : isActive
      ? 'bonds.operator.leave.desc'
      : 'bonds.operator.leave.standbyDesc'

  return (
    <div className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
      <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.operator.leave.title' })}
      </span>
      <span className="mt-4 font-main text-[15px] text-text0 dark:text-text0d">
        {intl.formatMessage({ id: headlineId })}
      </span>
      <span className="mt-2 font-main text-[13px] leading-relaxed text-gray2 dark:text-gray2d">
        {intl.formatMessage({ id: descId })}
      </span>
      {!isActive && (
        <span className="mt-2 font-main text-[12px] leading-relaxed text-gray2/80 dark:text-gray2d/80">
          {intl.formatMessage({ id: 'bonds.operator.leave.standbyNote' })}
        </span>
      )}
      <div className="mt-auto flex items-center justify-between gap-4 border-t border-solid border-gray0 pt-4 dark:border-gray0d">
        <span className="flex items-center gap-1.5 font-main text-[13px] text-gray2 dark:text-gray2d">
          {intl.formatMessage(
            { id: isActive ? 'bonds.operator.leave.toReturn' : 'bonds.operator.leave.yourShare' },
            { count: node.bondProviders.providers.length }
          )}
          <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
          <span className="text-text0 dark:text-text0d">
            {isPrivate ? hiddenString : formatRuneAmount(isActive ? node.bond : operatorBond(node))}
          </span>
        </span>
        <BorderButton size="normal" color="error" disabled={leaveLocked} onClick={onLeave}>
          {intl.formatMessage({ id: isActive ? 'bonds.operator.leave' : 'bonds.operator.leave.retire' })}
        </BorderButton>
      </div>
    </div>
  )
}
