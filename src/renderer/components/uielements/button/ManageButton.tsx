import React, { useCallback } from 'react'

import { BanknotesIcon } from '@heroicons/react/24/outline'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { DEFAULT_WALLET_TYPE } from '../../../const'
import * as poolsRoutes from '../../../routes/pools'
import * as walletRoutes from '../../../routes/wallet'
import { InteractType } from '../../wallet/txs/interact/Interact.types'
import { BorderButton } from './BorderButton'
import { FlatButton } from './FlatButton'
import type { Props as ButtonProps } from './FlatButton'

type ButtonVariant = 'runePool' | 'savers' | 'manage'

export type Props = Omit<ButtonProps, 'onClick'> & {
  variant: ButtonVariant
  asset?: AnyAsset
  interactType?: InteractType
  isTextView: boolean
  useBorderButton?: boolean
}

export const ManageButton = ({
  variant,
  asset,
  interactType,
  isTextView,
  useBorderButton = false,
  ...otherProps
}: Props) => {
  const intl = useIntl()
  const navigate = useNavigate()

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      event.preventDefault()
      event.stopPropagation()

      if (variant === 'runePool' && interactType) {
        navigate(walletRoutes.interact.path({ interactType }))
      } else if (variant === 'manage' && asset) {
        navigate(
          poolsRoutes.deposit.path({
            asset: assetToString(asset),
            assetWalletType: DEFAULT_WALLET_TYPE,
            dexWalletType: DEFAULT_WALLET_TYPE
          })
        )
      }
    },
    [variant, interactType, asset, navigate]
  )

  const ButtonComponent = useBorderButton ? BorderButton : FlatButton

  return (
    <ButtonComponent onClick={onClick} {...otherProps}>
      <BanknotesIcon className={clsx('h-4 w-4 text-inherit lg:h-5 lg:w-5', { 'mr-2': isTextView })} />
      <span className={isTextView ? 'mr-10px' : 'hidden'}>{intl.formatMessage({ id: 'common.manage' })}</span>
    </ButtonComponent>
  )
}
