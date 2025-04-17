import * as A from 'antd'
import styled from 'styled-components'

export const Collapse = styled(A.Collapse)`
  &.ant-collapse-icon-position-right > .ant-collapse-item > .ant-collapse-header {
    padding: 5px 0px;
  }

  &.ant-collapse-ghost > .ant-collapse-item > .ant-collapse-content > .ant-collapse-content-box {
    padding: 0;
  }

  &.ant-collapse > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow {
    right: 0px;
  }
`
