import { Fragment } from 'react'

import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { BaseButton } from '../../uielements/button'
import { CopyLabel } from '../../uielements/label'

export type Props = {
  visible: boolean
  phrase: string
  onClose?: FP.Lazy<void>
}

export const PhraseCopyModal = (props: Props) => {
  const { visible, phrase, onClose = FP.constVoid } = props

  const intl = useIntl()

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
          <div className="ease fixed inset-0 bg-bg0 dark:bg-bg0d" aria-hidden="true" />
        </Transition.Child>

        {/* container to center the panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          {/* dialog panel animated  */}
          <Transition.Child
            as={Fragment}
            enter="ease"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95">
            <Dialog.Panel
              className={clsx(
                'mx-auto flex flex-col items-center py-5',
                'w-full max-w-[360px]',
                'bg-bg0 dark:bg-bg0d',
                'rounded-lg border border-solid border-gray1 dark:border-gray0d'
              )}>
              <div className="flex w-full items-center justify-between px-5">
                <h1 className="my-0 text-center text-xl uppercase text-text2 dark:text-text2d">
                  {intl.formatMessage({ id: 'setting.view.phrase' })}
                </h1>
                <BaseButton
                  className="!p-0 text-gray1 hover:text-gray2 dark:text-gray1d hover:dark:text-gray2d focus:outline-none focus:ring-0"
                  onClick={onClose}>
                  <XMarkIcon className="h-20px w-20px text-inherit" />
                </BaseButton>
              </div>
              <div className="mt-4 flex flex-col items-center w-full px-4 gap-2">
                <div className="w-full grid grid-cols-3 border border-solid border-gray0 dark:border-gray0d rounded-xl p-2 gap-1">
                  {phrase.split(' ').map((item, index) => (
                    <span
                      key={index}
                      className="text-sm bg-turquoise/10 text-text0 dark:text-text0d font-bold px-2 py-1 rounded-full">
                      {index + 1}. {item}
                    </span>
                  ))}
                </div>
                <CopyLabel
                  className="text-turquoise"
                  label={intl.formatMessage({ id: 'common.copy' })}
                  textToCopy={phrase}
                />
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Transition>
    </Dialog>
  )
}
