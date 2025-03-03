import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Label } from '../../../components/uielements/label'
import { media } from '../../../helpers/styleHelper'

export const Title = styled(Label)`
  padding: 0 4px;
  font-size: 9px;
  text-transform: uppercase;
  color: ${palette('gray', 2)};
  width: auto;

  ${media.sm`
  font-size: 11px;
  `}

  ${media.lg`
  font-size: 13px;
  `}
`
