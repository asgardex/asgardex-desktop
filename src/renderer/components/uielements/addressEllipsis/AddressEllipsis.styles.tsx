import * as A from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

export const CopyLabel = styled(A.Typography.Text)`
  text-transform: uppercase;
  color: ${palette('primary', 2)};

  & .ant-typography-copy {
    display: flex !important;
  }

  svg {
    color: ${palette('primary', 2)};
  }
`
