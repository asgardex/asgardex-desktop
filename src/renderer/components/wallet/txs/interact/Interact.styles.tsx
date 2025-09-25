import styled from 'styled-components'
import { palette } from 'styled-theme'

import { media } from '../../../../helpers/styleHelper'
import { WalletTypeLabel as WalletTypeLabelUI } from '../../../uielements/common/Common.styles'
import { Fees as UIFees } from '../../../uielements/fees'
import { Label as UILabel } from '../../../uielements/label'

export const Container = styled('div')`
  min-height: 100%;
  width: 100%;
  max-width: 630px;
  display: flex;
  flex-direction: column;
  padding: 10px;

  ${media.sm`
    padding: 35px 50px 150px;
  `}
`

export const WalletTypeLabel = styled(WalletTypeLabelUI)`
  margin-left: 10px;
`

export const InputContainer = styled('div')`
  width: 100%;
  ${media.sm`
    max-width: 630px;
  `}
`

export const InputLabel = styled(UILabel)`
  padding: 0;
  font-size: 14px;
  text-transform: uppercase;
  color: ${palette('gray', 2)};
`

export const Fees = styled(UIFees)`
  padding-bottom: 20px;
`
