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

export const ResultContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-bottom: 30px;
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
  background: #f7f7f7; /* Optional styling for better readability */
  padding: 10px; /* Padding for spacing */
  border: 1px solid #ccc; /* Optional border for clarity */
`

// Style for displaying the status of each stage in the transaction
export const StageStatus = styled.div`
  margin-bottom: 10px; // Space between each status
  font-size: 16px; // Adjust font size as needed
  color: ${palette('text', 0)}; // Adjust color as needed
`

// Style for the close button at the bottom of the modal
export const CloseButton = styled(Button)`
  margin-top: 20px; // Space above the button
  width: 100%; // Full width button
  height: 40px; // Height of the button
  background-color: ${palette('primary', 0)}; // Primary color for the button
  color: ${palette('contrast', 0)}; // Text color for the button

  &:hover,
  &:focus {
    background-color: ${palette('primary', 1)}; // Slightly different color on hover/focus
  }
`
