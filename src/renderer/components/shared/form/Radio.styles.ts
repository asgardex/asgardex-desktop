import * as A from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Label as UILabel } from '../../uielements/label'

export const Radio = styled(A.Radio)`
  > .ant-radio .ant-radio-inner {
    border-color: ${palette('primary', 2)};
    background-color: ${palette('background', 0)};
  }

  > .ant-radio:hover .ant-radio-inner {
    border-color: ${palette('primary', 2)};
  }

  > .ant-radio-checked .ant-radio-inner {
    border-color: ${palette('primary', 2)};

    &::after {
      background-color: ${palette('primary', 2)};
    }
  }
`

export const RadioLabel = styled(UILabel).attrs({
  textTransform: 'uppercase',
  size: 'normal'
})`
  display: inline-block;
  padding: 0;
  margin: 0;
`
