import { ResultProps } from 'antd/lib/result'

import * as RStyled from '../result/ResultView.styles'
import * as Styled from './ErrorView.styles'

export type Props = Omit<ResultProps, 'icon'>

export const ErrorView = (props: Props): JSX.Element => (
  <RStyled.Result
    icon={
      <RStyled.IconWrapper>
        <Styled.Icon />
      </RStyled.IconWrapper>
    }
    {...props}
  />
)
