import { Row } from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { media } from '../../../helpers/styleHelper'

export const Wrapper = styled(Row)`
  /* id defined in svg */
  #down_icon {
    cursor: pointer;
    & > * {
      fill: ${palette('primary', 0)};
    }
  }

  width: 100%;

  ${media.lg`
    width: auto;
  `}
`
