import React, { useCallback } from 'react'

import { BanknotesIcon } from '@heroicons/react/24/outline'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import * as walletRoutes from '../../../routes/wallet'
import { InteractType } from '../../wallet/txs/interact/Interact.types'
import { FlatButton } from './FlatButton'
import type { Props as ButtonProps } from './FlatButton'

export type Props = Omit<ButtonProps, 'onClick'> & {
  interactType: InteractType
  isTextView: boolean
}
export const RunePoolButton: React.FC<Props> = ({ interactType, isTextView, ...otherProps }) => {
  const intl = useIntl()
  const navigate = useNavigate()
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      event.preventDefault()
      event.stopPropagation()
      navigate(walletRoutes.interact.path({ interactType }))
    },
    [interactType, navigate]
  )

  return (
    <FlatButton onClick={onClick} {...otherProps}>
      <BanknotesIcon className={`h-[16px] w-[16px] text-inherit lg:h-20px lg:w-20px ${isTextView ? `mr-[8px]` : ''}`} />
      <span className={`${isTextView ? 'mr-10px' : 'hidden'}`}>
        {intl.formatMessage({ id: 'wallet.action.deposit' })}
      </span>
    </FlatButton>
  )
}
