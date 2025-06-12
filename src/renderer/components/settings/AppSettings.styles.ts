import styled from 'styled-components'
import { palette } from 'styled-theme'

import { ExternalLinkIcon as ExternalLinkIconUI } from '../uielements/common/Common.styles'

export const ExternalLinkIcon = styled(ExternalLinkIconUI)`
  margin-left: 10px;
  color: ${palette('primary', 2)};
  svg {
    color: inherit;
  }
`
