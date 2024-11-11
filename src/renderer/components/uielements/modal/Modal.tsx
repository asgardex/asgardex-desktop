import React from 'react'

import { ModalProps } from 'antd/lib/modal'
import clsx from 'clsx'

import * as Styled from './Modal.styles'

interface Props extends ModalProps {
  className?: string
  children?: React.ReactNode
}

export const Modal: React.FC<Props> = ({ className = '', children, okButtonProps, ...rest }): JSX.Element => {
  return (
    <Styled.Modal
      className={clsx('modal-wrapper', className)}
      okButtonProps={{ ...okButtonProps, className: 'ok-ant-btn' }}
      cancelButtonProps={{ className: 'cancel-ant-btn' }}
      {...rest}>
      {children}
    </Styled.Modal>
  )
}
