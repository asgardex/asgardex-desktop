import styled from 'styled-components'
import { palette } from 'styled-theme'

import { media } from '../../../helpers/styleHelper'
import { Spin as UISpin } from '../../shared/loading'
import { Label as UILabel } from '../../uielements/label'

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: cemter;
  padding: 20px 10px 30px 20px;
  background-color: ${palette('background', 1)};
`

export const Spin = styled(UISpin)`
  padding-top: 16px;
`

export const BalanceTitle = styled(UILabel)`
  padding: 0 4px;
  font-size: 9px;
  text-transform: uppercase;
  color: ${palette('gray', 2)};
  width: auto;
  text-align: center;

  ${media.sm`
  font-size: 11px;
  `}

  ${media.lg`
  font-size: 13px;
  `}
`

export const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  vertical-items: center;
`

export const BalanceLabel = styled(UILabel)`
  margin: 16px 0px;
  font-size: 28px;
  color: ${palette('text', 2)};
  padding: 0 10px;
  text-align: center;
`

export const BalanceError = styled(UILabel).attrs({
  color: 'error'
})`
  text-transform: uppercase;
  font-size: 11px;
  line-height: 100%;
  padding: 5px;
  width: auto;
  text-align: center;

  ${media.sm`
  font-size: 14px;
  `}
`
