import { Button, Row } from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { ErrorView as UIErrorView } from '../../shared/error'
import { Button as UIButton } from '../../uielements/button'
import { Modal as UIModal } from '../../uielements/modal'

export const Modal = styled(UIModal)`
  &.ant-modal {
    width: 420px;

    .ant-modal-body {
      padding: 0px;
    }
  }
`

export const ContentRow = styled(Row).attrs({
  align: 'middle',
  justify: 'center'
})`
  width: 100%;
  padding: 30px 0;
  border-bottom: 1px solid ${palette('gray', 0)};
`

export const SubContentRow = styled(Row).attrs({
  align: 'middle',
  justify: 'center'
})`
  width: 100%;
`

export const ExtraResultContainer = styled(Row).attrs({
  align: 'middle',
  justify: 'center'
})`
  padding-top: 25px;
`

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
  display: block;
  font-size: 14px;
  line-height: 1.5;
  padding: 10px; /* Padding for spacing */
`

// Style for the close button at the bottom of the modal
export const CloseButton = styled(Button)`
  margin-top: 20px; // Space above the button
  width: 100%; // Full width button
  height: 40px; // Height of the button
  background-color: ${palette('primary', 2)}; // Primary color for the button
  color: ${palette('contrast', 0)}; // Text color for the button

  &:hover,
  &:focus {
    background-color: ${palette('primary', 1)}; // Slightly different color on hover/focus
  }
`
