import styled from 'styled-components'
import { palette } from 'styled-theme'

import { ExternalLinkIcon as UIExternalLinkIcon } from '../common/Common.styles'
import { Button as UIButton } from './Button'

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
