import { Checkbox } from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

export const FilterCheckbox = styled(Checkbox)`
  font-family: 'MainFontRegular';
  font-size: 14px;
  color: ${palette('gray', 2)};
  margin: 4px 0;

  .ant-checkbox-inner {
    border-color: ${palette('primary', 0)};
  }

  .ant-checkbox-checked .ant-checkbox-inner {
    background-color: ${palette('primary', 0)};
    border-color: ${palette('primary', 0)};
  }
`
