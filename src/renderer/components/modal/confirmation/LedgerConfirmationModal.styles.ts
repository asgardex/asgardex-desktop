import { ChevronRightIcon } from '@heroicons/react/24/outline'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import LedgerConnectUI from '../../../assets/svg/ledger-device-connect.svg?react'
import { media } from '../../../helpers/styleHelper'
import { AssetIcon as AssetIconUI } from '../../uielements/assets/assetIcon'
import { CopyLabel as CopyLabelUI } from '../../uielements/label'

export const LedgerConnect = styled(LedgerConnectUI)`
  transform: scale(0.65, 0.65);
  ${media.md`
    transform: scale(0.85, 0.85);
  `}
`

export const AssetIcon = styled(AssetIconUI)`
  position: absolute;
  top: 20px;
  left: 180px;
  transform: scale(0.7, 0.7);

  ${media.md`
    top: 21px;
    left: 170px;
    transform: scale(0.9, 0.9);
  `}
`

export const Description = styled.p`
  font-family: 'MainFontRegular';
  font-size: 12;
  text-align: center;
  color: ${palette('text', 2)};
`

export const AddressTitle = styled.p`
  font-family: 'MainFontBold';
  font-size: 10px;
  color: inherit;
  text-transform: uppercase;
  padding: 0;
  margin: 0;
`

export const ExpandIcon = styled(ChevronRightIcon)`
  svg {
    stroke: inherit; // Changed from color to stroke for Heroicons
    width: 16px; // Match Ant Design's default size
    height: 16px;
  }
`

export const CopyLabel = styled(CopyLabelUI)`
  color: ${palette('primary', 2)};
  padding-top: 20px;
  font-size: 12px;
`
