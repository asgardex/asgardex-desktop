import React from 'react'

import * as Styled from '../../uielements/common/Common.styles'

export type Props = {
  className?: string
  children?: React.ReactNode
}

export const WalletTypeLabel = ({ className = '', children }: Props) => (
  <Styled.WalletTypeLabel className={className}>{children}</Styled.WalletTypeLabel>
)
