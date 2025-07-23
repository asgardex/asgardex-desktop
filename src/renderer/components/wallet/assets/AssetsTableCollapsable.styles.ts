import * as A from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import {
  AssetSynthLabel as AssetSynthLabelUI,
  AssetSecuredLabel as AssetSecuredLabelUI
} from '../../uielements/common/Common.styles'

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
    height: 16px;
    width: 16px;
  }
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
