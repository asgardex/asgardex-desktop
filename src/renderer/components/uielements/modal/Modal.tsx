import React, { Fragment } from 'react'

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import { BaseButton } from '../button'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }

export type HeadlessModalProps = {
  visible: boolean
  title?: React.ReactNode
  onCancel?: () => void
  onOk?: () => void
  okText?: React.ReactNode
  cancelText?: React.ReactNode
  confirmLoading?: boolean
  footer?: boolean // show footer (default true)
  closable?: boolean // show "X" (default true)
  className?: string // wrapper
  panelClassName?: string // Dialog.Panel
  containerClassName?: string // centering container (the flex wrapper)
  okButtonProps?: ButtonProps
  cancelButtonProps?: ButtonProps
  children?: React.ReactNode
}

export const Modal = ({
  visible,
  title,
  onCancel,
  onOk,
  okText = 'OK',
  cancelText = 'Cancel',
  confirmLoading = false,
  footer = false,
  closable = true,
  className = '',
  panelClassName = '',
  containerClassName = '',
  okButtonProps,
  cancelButtonProps,
  children
}: HeadlessModalProps) => {
  return (
    <Transition appear show={visible} as={Fragment}>
      <Dialog as="div" className={clsx('relative z-50', className)} onClose={onCancel ?? (() => {})}>
        {/* Backdrop */}
        <DialogBackdrop className="fixed inset-0 bg-bg0/10 dark:bg-bg0d/10" />

        {/* Modal container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className={clsx('flex min-h-full items-center justify-center p-4', containerClassName)}>
            <TransitionChild
              as={Fragment}
              enter="transition duration-200 ease-out"
              enterFrom="opacity-0 translate-y-2 scale-95"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="transition duration-150 ease-in"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-2 scale-95">
              <DialogPanel
                className={clsx(
                  'w-full max-w-lg overflow-hidden rounded-lg border',
                  // body/bg/border map to your palette('background', 1) / palette('gray',0)
                  'border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d',
                  panelClassName
                )}>
                {/* Header — uppercase, centered, primary bg like palette('primary',2) */}
                <div className="relative px-3.5 py-2.5 text-center uppercase">
                  <DialogTitle as="h1" className="text-md mb-0 font-main tracking-wide text-text2 dark:text-text2d">
                    {title}
                  </DialogTitle>

                  {closable && (
                    <button
                      type="button"
                      onClick={onCancel}
                      className="absolute top-0 right-0 grid size-10 place-items-center rounded text-text1 focus:outline-hidden dark:text-text1d/90">
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Body — padding: 30px, text colors like palette('text',2) */}
                <div className="p-4">{children}</div>

                {/* Footer — height 46px, two equal buttons, uppercase */}
                {footer && (
                  <div className="h-11 border-t border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d">
                    <div className="flex h-full">
                      <button
                        type="button"
                        onClick={onCancel}
                        className={clsx(
                          'cancel-ant-btn h-full flex-1 rounded-none border-0 font-[MainFontRegular] text-sm uppercase',
                          // text/background like palette('text',2)/(background,1)
                          'bg-bg0 text-gray2 dark:bg-bg0d dark:text-gray2d',
                          // first-child right border like your styled rule
                          'border-r border-gray0 dark:border-gray0d',
                          'hover:text-turquoise focus:outline-hidden focus-visible:ring-2 focus-visible:ring-turquoise dark:hover:text-turquoise',
                          cancelButtonProps?.className
                        )}
                        {...cancelButtonProps}>
                        {cancelText}
                      </button>

                      <button
                        type="button"
                        onClick={onOk}
                        disabled={confirmLoading}
                        className={clsx(
                          'ok-ant-btn h-full flex-1 rounded-none border-0 font-[MainFontRegular] text-sm uppercase',
                          // primary text like palette('primary',2)
                          'bg-bg0 text-turquoise dark:bg-bg0d dark:text-turquoise',
                          'hover:bg-turquoise/10',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-turquoise',
                          okButtonProps?.className
                        )}
                        {...okButtonProps}>
                        {confirmLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <svg className="size-4 animate-spin" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                              />
                            </svg>
                            {okText}
                          </span>
                        ) : (
                          okText
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
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
            'w-full max-w-[360px] md:max-w-[480px]',
            'bg-bg0 dark:bg-bg0d',
            'rounded-lg border border-solid border-gray1 dark:border-gray0d',
            className
          )}>
          <div className="flex w-full items-center justify-between rounded-t-lg px-4">
            <h1 className="my-0 text-center text-xl text-text2 uppercase dark:text-text2d">{title}</h1>
            <BaseButton
              className="!p-0 text-gray1 hover:text-gray2 dark:text-gray1d dark:hover:text-gray2d"
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
