import React, { useCallback } from 'react'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { BaseButton } from '../../uielements/button'

type Props = {
  visible: boolean
  title?: string
  okText?: string
  content: React.ReactNode
  onSuccess: FP.Lazy<void>
  onClose: FP.Lazy<void>
}

export const ConfirmationModal = ({ visible, title, okText, content, onSuccess, onClose }: Props) => {
  const intl = useIntl()

  const onOkHandler = useCallback(() => {
    onSuccess()
    onClose()
  }, [onSuccess, onClose])

  return (
    <Dialog as="div" className="relative z-10" transition open={visible} onClose={onClose}>
      <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
      {/* container to center the panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        {/* dialog panel animated  */}
        <DialogPanel
          className={clsx(
            'mx-auto flex flex-col items-center p-6',
            'w-full max-w-[360px] md:max-w-[480px]',
            'bg-bg0 dark:bg-bg0d',
            'rounded-lg border border-solid border-gray0 dark:border-gray0d'
          )}>
          <div className="flex w-full items-center justify-between">
            <h1 className="mb-4 text-center text-xl uppercase text-text2 dark:text-text2d">
              {title || intl.formatMessage({ id: 'common.modal.confirmTitle' })}
            </h1>
          </div>
          <div className="w-full mb-6">{content}</div>
          <div className="flex w-full items-center justify-end gap-2">
            <BaseButton
              className={clsx(
                '!px-4 !py-2 rounded-md',
                'border border-solid border-gray1/20 dark:border-gray1d/20',
                'text-text0 dark:text-text0d',
                'hover:bg-gray1/20 hover:dark:bg-gray1d/20'
              )}
              onClick={onClose}>
              {intl.formatMessage({ id: 'common.cancel' })}
            </BaseButton>
            <BaseButton
              className="rounded-lg !px-4 !py-2 text-white bg-turquoise hover:bg-turquoise/80"
              onClick={onOkHandler}>
              {okText || intl.formatMessage({ id: 'common.confirm' })}
            </BaseButton>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
