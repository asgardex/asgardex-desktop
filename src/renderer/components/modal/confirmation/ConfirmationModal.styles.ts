import { LockOutlined as BaseLockOutlined } from '@ant-design/icons/lib'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Label as UILabel } from '../../uielements/label'
import { Modal as BaseModal } from '../../uielements/modal'

export const Modal = styled(BaseModal)`
  .ant-modal-body {
    .ant-form-item {
      margin-bottom: 0;
    }
  }
`

export const LockOutlined = styled(BaseLockOutlined)`
  color: ${palette('text', 0)};
`
export const ConfirmationModalText = styled(UILabel)`
  font-family: 'MainFontRegular';
  text-transform: uppercase;
  text-align: center;
  font-size: 14px;
`
