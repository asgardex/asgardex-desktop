import { CaretRightOutlined, EyeInvisibleOutlined } from '@ant-design/icons'
import * as A from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Label as UILabel } from '../../../components/uielements/label'
import {
  WalletTypeLabel as WalletTypeLabelUI,
  AssetSynthLabel as AssetSynthLabelUI,
  AssetSecuredLabel as AssetSecuredLabelUI
} from '../../uielements/common/Common.styles'
import { Table as UITable } from '../../uielements/table'

export const Table = styled(UITable)`
  .ant-table {
    background: ${palette('background', 0)};
    border-radius: 8px;
  }

  .ant-table-tbody > tr {
    & > td {
      border-bottom: 1px solid ${palette('gray', 0)};
    }

    &:last-child {
      & > td {
        border: none;
      }

      &:last-child {
        & > td {
          &:first-child {
            border-radius: 0 0 0 8px;
          }

          &:last-child {
            border-radius: 0 0 8px 0;
          }
        }
      }
    }
  }

  .ant-table-tbody > tr > td {
    padding: 0px 16px;
  }

  .ant-table-tbody > tr > td > div {
    font-size: 16px;
    font-weight: normal;
    text-transform: uppercase;
  }
`

export const HeaderRow = styled(A.Row)`
  font-size: 14px;
  font-family: 'MainFontRegular';
  color: ${palette('gray', 2)};
`

export const HeaderLabel = styled(UILabel).attrs({
  textTransform: 'uppercase',
  size: 'normal'
})`
  width: auto;
  padding: 0;
`

export const HeaderAddress = styled(UILabel).attrs({
  textTransform: 'none',
  color: 'gray',
  size: 'normal'
})`
  padding: 0;
`

export const Label = styled(UILabel)`
  font-size: 16px;
`

export const TickerLabel = styled(UILabel).attrs({
  textTransform: 'uppercase',
  weight: 'bold'
})`
  padding: 0px;
  font-size: 16px;
  line-height: 18px;
`

export const ChainLabelWrapper = styled.div`
  display: flex;
  align-items: center;
`

export const ChainLabel = styled(TickerLabel)`
  color: ${palette('gray', 2)};
  font-size: 12px;
  font-weight: 500;
`

export const Collapse = styled(A.Collapse)`
  &.ant-collapse > .ant-collapse-item {
    border: 1px solid ${palette('gray', 0)};
    border-radius: 8px;
  }

  &.ant-collapse > .ant-collapse-item > .ant-collapse-header {
    background-color: ${palette('background', 0)};
    padding: 5px 20px;
    transition: none;
    border-radius: 8px;
  }

  &.ant-collapse > .ant-collapse-item-active > .ant-collapse-header {
    border-bottom: 1px solid ${palette('gray', 0)};
    border-radius: 8px 8px 0px 0px;
  }

  &.ant-collapse > .ant-collapse-item > .ant-collapse-header .ant-collapse-header-text {
    width: 100%;
  }

  &.ant-collapse-ghost > .ant-collapse-item > .ant-collapse-content > .ant-collapse-content-box {
    padding: 0;
  }
`

export const ExpandIcon = styled(CaretRightOutlined)`
  margin-top: -13px;
  svg {
    color: ${palette('primary', 2)};
  }
`

export const HideIcon = styled(EyeInvisibleOutlined)`
  svg {
    color: ${palette('gray', 2)};
  }
  /* TODO (@Veado)
    Change to pointer if hide asset feature is implemented
    see https://github.com/thorchain/asgardex-electron/issues/476
  */
  cursor: pointer;
`

const ICON_SIZE = 16

export const CopyLabel = styled(A.Typography.Text)`
  text-transform: uppercase;
  color: ${palette('primary', 2)};
  border: 1px solid ${palette('gray', 1)};
  border-radius: 8px;
  margin-left: 8px;

  > div:first-child {
    display: flex !important;
    align-items: center;
    justify-content: center;

    margin: 0px;

    width: 30px;
    height: 30px;
  }

  svg {
    color: ${palette('text', 0)};
    height: ${ICON_SIZE}px;
    width: ${ICON_SIZE}px;
  }
`

export const AssetTickerWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`

export const WalletTypeLabel = styled(WalletTypeLabelUI)`
  background: ${palette('background', 2)};
  border: 1px solid ${palette('gray', 0)};
`

export const AssetSynthLabel = styled(AssetSynthLabelUI)`
  margin-top: 2px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 12px;
`

export const AssetSecuredLabel = styled(AssetSecuredLabelUI)`
  margin-top: 2px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 12px;
`
