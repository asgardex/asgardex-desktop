import React from 'react'

import { PlusCircleOutlined, MinusCircleOutlined, ExperimentOutlined, StopOutlined } from '@ant-design/icons'
import { useIntl } from 'react-intl'

import { ReactComponent as DonateIcon } from '../../../assets/svg/tx-donate.svg'
import { ReactComponent as RefundIcon } from '../../../assets/svg/tx-refund.svg'
import { ReactComponent as RunePoolIcon } from '../../../assets/svg/tx-runePool.svg'
import { ReactComponent as SendIcon } from '../../../assets/svg/tx-send.svg'
import { ReactComponent as DepositIcon } from '../../../assets/svg/tx-stake.svg'
import { ReactComponent as SwapIcon } from '../../../assets/svg/tx-swap.svg'
import { ReactComponent as WithdrawIcon } from '../../../assets/svg/tx-withdraw.svg'
import { getTxTypeI18n } from '../../../helpers/actionsHelper'
import { TxType as MidgardTxType } from '../../../services/midgard/types'
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
      return <PlusCircleOutlined className="text-[18px] !text-turquoise" />
    case 'UNBOND':
    case 'LEAVE':
      return <MinusCircleOutlined className="text-[18px] !text-turquoise" />
    case 'TRADE':
      return <ExperimentOutlined className="text-[18px] !text-turquoise" />
    case 'FAILED':
      return <StopOutlined className="text-[18px] !text-red" />
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
