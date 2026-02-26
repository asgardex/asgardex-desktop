import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
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
      <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
      {/* container to center the panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        {/* dialog panel animated  */}
        <DialogPanel
          className={clsx(
            'mx-auto flex flex-col items-center py-5',
            'w-full max-w-[420px]',
            'bg-bg0 dark:bg-bg0d',
            'rounded-lg border border-solid border-gray1 dark:border-gray0d'
          )}>
          <div className="flex w-full items-center justify-between px-5">
            <h1 className="my-0 text-center text-xl text-text2 uppercase dark:text-text2d">
              {intl.formatMessage({ id: 'settings.view.phrase.title' })}
            </h1>
            <BaseButton
              className="!p-0 text-gray1 hover:text-gray2 focus:ring-0 focus:outline-hidden dark:text-gray1d dark:hover:text-gray2d"
              onClick={onClose}>
              <XMarkIcon className="h-20px w-20px text-inherit" />
            </BaseButton>
          </div>
          <div className="mt-4 flex w-full flex-col items-center gap-2 px-4">
            <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-solid border-gray0 p-2 dark:border-gray0d">
              {phrase.split(' ').map((item, index) => (
                <span
                  key={index}
                  className="rounded-full bg-turquoise/10 px-2 py-1 text-sm font-bold text-text0 dark:text-text0d">
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
        </DialogPanel>
      </div>
    </Dialog>
  )
}
