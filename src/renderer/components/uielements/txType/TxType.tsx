import React from 'react'

import { PlusCircleIcon, MinusCircleIcon, BeakerIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useIntl } from 'react-intl'

import DonateIcon from '../../../assets/svg/tx-donate.svg?react'
import RefundIcon from '../../../assets/svg/tx-refund.svg?react'
import RunePoolIcon from '../../../assets/svg/tx-runePool.svg?react'
import SendIcon from '../../../assets/svg/tx-send.svg?react'
import DepositIcon from '../../../assets/svg/tx-stake.svg?react'
import SwapIcon from '../../../assets/svg/tx-swap.svg?react'
import WithdrawIcon from '../../../assets/svg/tx-withdraw.svg?react'
import { getTxTypeI18n } from '../../../helpers/actionsHelper'
import { TxType as MidgardTxType } from '../../../services/midgard/midgardTypes'
import * as Styled from './TxType.styles'

type Props = {
  type: MidgardTxType
  showTypeIcon: boolean
  className?: string
}

const getIcon = (type: MidgardTxType) => {
  switch (type) {
    case 'DEPOSIT':
      return <DepositIcon />
    case 'WITHDRAW':
      return <WithdrawIcon />
    case 'SWAP':
      return <SwapIcon />
    case 'DONATE':
      return <DonateIcon />
    case 'REFUND':
      return <RefundIcon />
    case 'SEND':
      return <SendIcon />
    case 'RUNEPOOLDEPOSIT':
      return <RunePoolIcon />
    case 'RUNEPOOLWITHDRAW':
      return <RunePoolIcon className="rotate-180" />
    case 'BOND':
      return <PlusCircleIcon className="!stroke-turquoise" width={18} height={18} />
    case 'UNBOND':
    case 'LEAVE':
      return <MinusCircleIcon className="!text-turquoise" width={18} height={18} />
    case 'TRADE':
      return <BeakerIcon className="!text-turquoise" width={18} height={18} />
    case 'FAILED':
      return <XMarkIcon className="!stroke-red" width={18} height={18} />
    default:
      return <></>
  }
}

export const TxType: React.FC<Props> = ({ type, showTypeIcon, className }) => {
  const intl = useIntl()

  return (
    <Styled.Container className={className}>
      {showTypeIcon && <Styled.IconContainer>{getIcon(type)}</Styled.IconContainer>}
      <Styled.Label>{getTxTypeI18n(type, intl)}</Styled.Label>
    </Styled.Container>
  )
}
