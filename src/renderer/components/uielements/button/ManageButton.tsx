import React, { useCallback } from 'react'

import { BanknotesIcon, PlusIcon } from '@heroicons/react/24/outline'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { FlatButton, BorderButton } from '.'
import { DEFAULT_WALLET_TYPE } from '../../../const'
import * as poolsRoutes from '../../../routes/pools'
import * as saversRoutes from '../../../routes/pools/savers'
import * as walletRoutes from '../../../routes/wallet'
import { InteractType } from '../../wallet/txs/interact/Interact.types'
import type { Props as ButtonProps } from './FlatButton'

export type ButtonVariant = 'runePool' | 'savers' | 'manage'

export type Props = Omit<ButtonProps, 'onClick'> & {
  variant: ButtonVariant
  asset?: AnyAsset
  interactType?: InteractType
  isTextView: boolean
  useBorderButton?: boolean
}

export const ManageButton: React.FC<Props> = ({
  variant,
  asset,
  interactType,
  isTextView,
  useBorderButton = false,
  ...otherProps
}) => {
  const intl = useIntl()
  const navigate = useNavigate()

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      event.preventDefault()
      event.stopPropagation()

      if (variant === 'runePool' && interactType) {
        navigate(walletRoutes.interact.path({ interactType }))
      } else if (variant === 'savers' && asset) {
        navigate(saversRoutes.withdraw.path({ asset: assetToString(asset), walletType: DEFAULT_WALLET_TYPE }))
      } else if (variant === 'manage' && asset) {
        navigate(
          poolsRoutes.deposit.path({
            asset: assetToString(asset),
            assetWalletType: DEFAULT_WALLET_TYPE,
            runeWalletType: DEFAULT_WALLET_TYPE
          })
        )
      }
    },
    [variant, interactType, asset, navigate]
  )

  const ButtonComponent = useBorderButton ? BorderButton : FlatButton
  const IconComponent = variant === 'manage' ? PlusIcon : BanknotesIcon

  return (
    <ButtonComponent onClick={onClick} {...otherProps}>
      <IconComponent className={`h-[16px] w-[16px] text-inherit lg:h-20px lg:w-20px ${isTextView ? `mr-[8px]` : ''}`} />
      <span className={`${isTextView ? 'mr-10px' : 'hidden'}`}>{intl.formatMessage({ id: 'common.manage' })}</span>
    </ButtonComponent>
  )
}
