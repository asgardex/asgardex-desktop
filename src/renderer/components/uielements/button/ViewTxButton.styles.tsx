import * as A from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { ExternalLinkIcon as UIExternalLinkIcon } from '../common/Common.styles'
import { Button as UIButton } from './Button'

export const Wrapper = styled.div`
  display: flex;
  align-items: center;
`

const ExternalLinkIcon = styled(UIExternalLinkIcon)`
  svg {
    color: ${palette('primary', 2)};
  }
`

export const ViewTxButton = styled(UIButton).attrs({
  typevalue: 'transparent',
  icon: <ExternalLinkIcon />
})`
  padding-right: 5px;
`

const ICON_SIZE = 19

export const CopyLabel = styled(A.Typography.Text)`
  color: ${palette('primary', 2)};

  svg {
    color: ${palette('primary', 2)};
    height: ${ICON_SIZE}px;
    width: ${ICON_SIZE}px;
  }
`
