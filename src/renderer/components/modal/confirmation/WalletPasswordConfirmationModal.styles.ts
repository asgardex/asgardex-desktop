import styled from 'styled-components'

import WalletIconSVG from '../../../assets/svg/icon-wallet.svg?react'
import { media } from '../../../helpers/styleHelper'

export const WalletIcon = styled(WalletIconSVG)`
  width: 20%;
  height: 20%;
  align-self: center;
  & > * {
    fill: #cccccc;
  }

  ${media.md`
  width: 30%;
  height: 30%;
  `}
`

export const Description = styled.p`
  font-family: 'MainFontRegular';
  font-size: 12;
  text-align: center;
`
