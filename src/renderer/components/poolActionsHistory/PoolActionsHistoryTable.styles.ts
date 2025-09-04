import styled from 'styled-components'

import { media } from '../../helpers/styleHelper'
import { TxType as TxTypeUI } from '../uielements/txType'

export const TxType = styled(TxTypeUI)`
  & .label-wrapper {
    display: none;
  }

  ${media.lg`
    & .label-wrapper {
      display: initial;
    }
  `}
`
