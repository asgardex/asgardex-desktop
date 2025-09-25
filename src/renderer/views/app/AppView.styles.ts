import styled from 'styled-components'

import { Alert as UIAlert } from '../../components/uielements/alert'
import { media } from '../../helpers/styleHelper'

export const Alert = styled(UIAlert)`
  margin-bottom: 10px;

  ${media.lg`
    margin-bottom: 40px;

    &:first-child {
      margin-bottom: 10px;
    }
  `}
`
