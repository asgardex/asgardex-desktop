import React, { Fragment, useCallback } from 'react'

import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import * as FP from 'fp-ts/function'
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
    <Dialog as="div" className="relative z-10" open={visible} onClose={onClose}>
      <Transition appear show={visible} as="div">
        {/* backdrop animated */}
        <Transition.Child
          enter="ease"
          enterFrom="opacity-0"
          enterTo="opacity-70"
          leave="ease"
          leaveFrom="opacity-70"
          leaveTo="opacity-0">
          <div className="ease fixed inset-0 bg-bg0d dark:bg-bg0d" aria-hidden="true" />
        </Transition.Child>

        {/* container to center the panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          {/* dialog panel animated  */}
          <Transition.Child
            as={Fragment}
            enter="ease"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95">
            <Dialog.Panel
              className={clsx(
                'mx-auto flex flex-col items-center pt-5 pb-2',
                'w-full max-w-[360px] md:max-w-[480px]',
                'bg-bg0 dark:bg-bg0d',
                'rounded-lg border border-solid border-gray1 dark:border-gray0d'
              )}>
              <div className="flex w-full items-center justify-between px-5">
                <h1 className="my-0 text-center text-xl uppercase text-text2 dark:text-text2d">
                  {title || intl.formatMessage({ id: 'common.modal.confirmTitle' })}
                </h1>
                <BaseButton
                  className="!p-0 text-gray1 hover:text-gray2 dark:text-gray1d hover:dark:text-gray2d"
                  onClick={() => onClose()}>
                  <XMarkIcon className="h-20px w-20px text-inherit" />
                </BaseButton>
              </div>
              <div className="my-4 h-[1px] w-full bg-gray1 dark:bg-gray0d" />
              <div className="w-full px-4">{content}</div>
              <div className="mt-4 mb-2 h-[1px] w-full bg-gray1 dark:bg-gray0d" />
              <div className="flex w-full items-center justify-end px-4">
                <div className="flex items-center space-x-4">
                  <BaseButton
                    className="!p-0 text-gray1 hover:text-gray2 dark:text-gray1d hover:dark:text-gray2d"
                    onClick={onClose}>
                    {intl.formatMessage({ id: 'common.cancel' })}
                  </BaseButton>
                  <BaseButton className="rounded-xl !p-2 text-turquoise hover:bg-turquoise/10" onClick={onOkHandler}>
                    {okText || intl.formatMessage({ id: 'common.confirm' })}
                  </BaseButton>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Transition>
    </Dialog>
  )
}
