import * as A from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { media } from '../../helpers/styleHelper'
import { AddressEllipsis as AddressEllipsisUI } from '../uielements/addressEllipsis'
import { Button as UIButton } from '../uielements/button'
import { WalletTypeLabel as WalletTypeLabelUI } from '../uielements/common/Common.styles'
import { Label as UILabel } from '../uielements/label'

export const AutoComplete = styled(A.AutoComplete)`
  .ant-select-selector {
    border-color: ${palette('gray', 1)} !important;
    background-color: ${palette('background', 0)} !important;
    color: ${palette('text', 0)};
  }
`

export const Subtitle = styled(UILabel)`
  text-align: center;
  padding: 20px 0 0 20px;
  color: ${palette('text', 0)};
  text-transform: uppercase;
  font-family: 'MainFontRegular';
  font-size: 16px;

  ${media.md`
    text-align: left;
  `}
`

export const List = styled(A.List)`
  li {
    border-bottom: 1px solid ${palette('gray', 0)};
  }
`

export const ListItem = styled(A.List.Item)`
  padding: 20px;
  flex-direction: column;
  align-items: start;

  border-bottom: none;
  border-bottom: 1px solid ${palette('gray', 0)} !important;
  .ant-list-item {
    border-bottom: 1px solid ${palette('gray', 0)};
  }
`

export const AccountTitle = styled(UILabel)`
  padding: 0px;
  padding-left: 10px;
  text-transform: uppercase;
  font-weight: normal;
  font-size: 20px;
  line-height: 25px;
  letter-spacing: 2px;
`

export const AddressEllipsis = styled(AddressEllipsisUI)`
  font-size: 16px;
  font-family: 'MainFontRegular';
  color: ${palette('text', 1)};
  max-width: 100%;
  overflow: hidden;
  &:only-child {
    margin: auto;
  }
  & svg {
    height: 16px;
    width: 16px;
  }
`

export const AddLedgerButton = styled(UIButton).attrs({
  typevalue: 'transparent'
})`
  padding-left: 0;
  font-size: 17px;
  cursor: pointer;
`

export const WalletIndexInput = styled(A.InputNumber)`
  color: ${palette('text', 2)};
  background-color: ${palette('background', 1)};
  margin-left: 10px;
  margin-right: 5px;
  max-width: 50px;
  border-radius: 8px;
  padding: 0px;
`

export const WalletTypeLabel = styled(WalletTypeLabelUI)`
  margin-left: 40px;
  display: inline-block;
`

export const Icon = styled.div`
  display: inline-block;
  margin-right: 5px;

  svg {
    width: 15px;
    height: 15px;
    stroke: ${palette('warning', 0)};
    fill: none;
  }
`
