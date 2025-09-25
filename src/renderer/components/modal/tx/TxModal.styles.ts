import styled from 'styled-components'

import { ErrorView as UIErrorView } from '../../shared/error'
import { Button as UIButton } from '../../uielements/button'

export const ResultButton = styled(UIButton)`
  width: 300px;
  height: 40px;
  margin-top: 25px;
`

export const ErrorView = styled(UIErrorView)`
  padding: 0px;
  max-width: 100%;
  word-break: break-all;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  overflow: auto;
  font-size: 14px;
  line-height: 1.5;
  padding: 10px; /* Padding for spacing */
`
