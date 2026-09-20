import { TrashIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { WalletType } from '../../../../shared/wallet/types'
import { truncateAddress } from '../../../helpers/addressHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { OperatorNodeInfo } from '../../../hooks/useOperatorNodes'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BaseButton } from '../../uielements/button'
import { WalletTypeLabel } from '../../uielements/common'
import { CopyLabel } from '../../uielements/label'
import { Tooltip } from '../../uielements/tooltip'
import { formatOperatorFee, formatRuneAmount } from './helpers'
import { NodeStatusTag } from './NodeStatusTag'

type Props = {
  network: Network
  isPrivate: boolean
  node: OperatorNodeInfo
  operatorWalletType?: WalletType
  onRemoveMonitored: (nodeAddress: Address) => void
  onOpenDetail: (nodeAddress: Address) => void
}

export const OperatorNodeCard = ({
  network,
  isPrivate,
  node,
  operatorWalletType,
  onRemoveMonitored,
  onOpenDetail
}: Props) => {
  const intl = useIntl()

  const feePercent = formatOperatorFee(node.bondProviders.nodeOperatorFee, intl.locale)

  const openDetail = () => onOpenDetail(node.address)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openDetail()
        }
      }}
      className={clsx(
        'group flex cursor-pointer flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d',
        'transition-colors hover:border-turquoise focus-visible:border-turquoise focus-visible:outline-none dark:hover:border-turquoise dark:focus-visible:border-turquoise'
      )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <span className="font-main text-[16px] text-text0 group-hover:text-turquoise dark:text-text0d">
            {truncateAddress(node.address, THORChain, network)}
          </span>
          <div onClick={(event) => event.stopPropagation()}>
            <CopyLabel textToCopy={node.address} iconClassName="!h-4 !w-4" />
          </div>
          {operatorWalletType && (
            <WalletTypeLabel className="ml-1 text-[9px] leading-3">
              {walletTypeToI18n(operatorWalletType, intl)}
            </WalletTypeLabel>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NodeStatusTag status={node.status} />
          {node.isMonitored && !node.isOperator && (
            <Tooltip title={intl.formatMessage({ id: 'bonds.operator.removeMonitored' })}>
              <BaseButton
                className="!p-0 text-gray2 hover:text-error0 dark:text-gray2d"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemoveMonitored(node.address)
                }}>
                <TrashIcon className="h-[16px] w-[16px] text-inherit" />
              </BaseButton>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <AssetIcon asset={AssetRuneNative} size="small" network={network} />
        <span className="font-main-bold text-[32px] leading-none text-text0 dark:text-text0d">
          {isPrivate ? hiddenString : formatRuneAmount(node.bond)}
        </span>
      </div>
      <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
        {intl.formatMessage(
          { id: 'bonds.operator.nodeSummary' },
          { count: node.bondProviders.providers.length, fee: feePercent }
        )}
      </span>
    </div>
  )
}
