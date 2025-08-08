import * as A from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import {
  AssetSynthLabel as AssetSynthLabelUI,
  AssetSecuredLabel as AssetSecuredLabelUI
} from '../../uielements/common/Common.styles'

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
