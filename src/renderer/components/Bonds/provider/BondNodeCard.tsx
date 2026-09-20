import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { truncateAddress } from '../../../helpers/addressHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { NodeStatusEnum } from '../../../services/thorchain/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { BondProviderPosition } from '../../../views/bonds/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { FlatButton } from '../../uielements/button'
import { WalletTypeLabel } from '../../uielements/common'
import { CopyLabel } from '../../uielements/label'
import { formatRuneAmount, isUnbondLocked } from './helpers'
import { NodeStatusTag } from './NodeStatusTag'

type Props = {
  network: Network
  isPrivate: boolean
  position: BondProviderPosition
  lastPayout: RD.RemoteData<Error, O.Option<BaseAmount>>
  showWalletType?: boolean
  onBondMore: (position: BondProviderPosition) => void
  onUnbond: (position: BondProviderPosition) => void
  onOpenDetail: (position: BondProviderPosition) => void
}

export const BondNodeCard = ({
  network,
  isPrivate,
  position,
  lastPayout,
  onBondMore,
  onUnbond,
  showWalletType = false,
  onOpenDetail
}: Props) => {
  const intl = useIntl()

  const isActive = position.status === NodeStatusEnum.Active
  const unbondLocked = isUnbondLocked(position.status, position.signMembership)

  const subtitle = isActive
    ? FP.pipe(
        lastPayout,
        RD.toOption,
        O.flatten,
        O.fold(
          () => null,
          (amount) =>
            intl.formatMessage(
              { id: 'bonds.provider.node.paidLastChurn' },
              { amount: isPrivate ? hiddenString : formatRuneAmount(amount) }
            )
        )
      )
    : intl.formatMessage({
        id: unbondLocked ? 'bonds.provider.node.notEarningLocked' : 'bonds.provider.node.notEarning'
      })

  const openDetail = () => onOpenDetail(position)

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-main text-[16px] text-text0 group-hover:text-turquoise dark:text-text0d">
            {truncateAddress(position.nodeAddress, THORChain, network)}
          </span>
          <div onClick={(event) => event.stopPropagation()}>
            <CopyLabel textToCopy={position.nodeAddress} iconClassName="!h-4 !w-4" />
          </div>
          {showWalletType && (
            <WalletTypeLabel className="ml-1 text-[9px] leading-3">
              {walletTypeToI18n(position.signer.walletType, intl)}
            </WalletTypeLabel>
          )}
        </div>
        <NodeStatusTag status={position.status} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <AssetIcon asset={AssetRuneNative} size="small" network={network} />
        <span className="font-main-bold text-[32px] leading-none text-text0 dark:text-text0d">
          {isPrivate ? hiddenString : formatRuneAmount(position.myBond)}
        </span>
      </div>
      {subtitle && <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">{subtitle}</span>}
      <FlatButton
        className="mt-6 w-full"
        size="large"
        onClick={(event) => {
          event.stopPropagation()
          unbondLocked ? onBondMore(position) : onUnbond(position)
        }}>
        {intl.formatMessage({ id: unbondLocked ? 'bonds.provider.bondMore' : 'bonds.provider.unbond' })}
      </FlatButton>
    </div>
  )
}
