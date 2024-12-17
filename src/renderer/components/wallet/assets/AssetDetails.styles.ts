import styled from 'styled-components'

import { ExternalLinkIcon as ExternalLinkIconUI } from '../../uielements/common/Common.styles'
import { Label as UILabel } from '../../uielements/label'

export const Label = styled(UILabel).attrs({
  textTransform: 'uppercase',
  align: 'center',
  color: 'primary',
  size: 'big'
})`
  cursor: pointer;
`

export const TableHeadlineLinkIcon = styled(ExternalLinkIconUI)`
  margin-left: 10px;
  svg {
    color: inherit;
  }
`
