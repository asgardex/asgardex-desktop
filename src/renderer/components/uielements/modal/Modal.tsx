import React from 'react'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { ModalProps } from 'antd/lib/modal'
import clsx from 'clsx'

import { BaseButton } from '../button'
import * as Styled from './Modal.styles'

interface Props extends ModalProps {
  className?: string
  children?: React.ReactNode
}

export const Modal = ({ className = '', children, okButtonProps, ...rest }: Props): JSX.Element => {
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

export const HeadlessModal = ({
  className,
  title,
  isOpen,
  children,
  initialFocus,
  onClose
}: {
  className?: string
  title: string
  isOpen: boolean
  children: React.ReactNode
  initialFocus?: React.MutableRefObject<HTMLElement | null> | undefined
  onClose: () => void
}) => {
  return (
    <Dialog as="div" className="relative z-10" initialFocus={initialFocus} open={isOpen} onClose={onClose}>
      <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className={clsx(
            'mx-auto flex flex-col items-center py-5',
            'h-3/4 max-h-[600px] min-h-[350px] w-full max-w-[360px] md:max-w-[480px]',
            'bg-bg0 dark:bg-bg0d',
            'rounded-lg border border-solid border-turquoise/80',
            className
          )}>
          <div className="flex w-full items-center justify-between rounded-t-lg px-4">
            <h1 className="my-0 text-center text-xl uppercase text-text2 dark:text-text2d">{title}</h1>
            <BaseButton
              className="!p-0 text-gray1 hover:text-gray2 dark:text-gray1d hover:dark:text-gray2d"
              onClick={() => onClose()}>
              <XMarkIcon className="h-20px w-20px text-inherit" />
            </BaseButton>
          </div>
          <div className="my-4 h-[1px] w-full bg-gray1 dark:bg-gray0d" />
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
