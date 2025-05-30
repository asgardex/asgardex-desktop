import React, { useCallback, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'

import { useAggregator } from '../../../store/aggregator/hooks'
import { ProviderIcon } from '../../swap/ProviderIcon'
import { BaseButton } from '../../uielements/button'
import { SwitchButton } from '../../uielements/button/SwitchButton'

export type Props = {
  open: boolean
  onClose: FP.Lazy<void>
}

const AllProtocols: Protocol[] = ['Thorchain', 'Mayachain', 'Chainflip']

export const ProviderModalContent = (props: Props) => {
  const { open, onClose } = props
  const { protocols, setAggProtocol } = useAggregator()

  const onToggleSwitch = useCallback(
    (protocol: Protocol, isActive: boolean) => {
      setAggProtocol(protocol, isActive)
    },
    [setAggProtocol]
  )

  const onCloseMenu = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <Dialog as="div" className="relative z-10" open={open} onClose={onCloseMenu}>
      <Transition appear show={open} as="div">
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
                <h1 className="my-0 text-center text-xl uppercase text-text2 dark:text-text2d">Select Protocols</h1>
                <BaseButton
                  className="!p-0 text-gray1 hover:text-gray2 dark:text-gray1d hover:dark:text-gray2d focus:outline-none focus:ring-0"
                  onClick={onCloseMenu}>
                  <XMarkIcon className="h-20px w-20px text-inherit" />
                </BaseButton>
              </div>
              <span className="mt-2 px-5 text-gray1 dark:text-gray1d text-sm">
                Choose which protocols to consider when finding optimal swap routes.
              </span>
              <div className="mt-4 flex flex-col w-full px-4 gap-2">
                {AllProtocols.map((protocol) => (
                  <div key={protocol} className="flex itesm-center justify-between">
                    <div className="flex items-center gap-2">
                      <ProviderIcon className="w-8 h-8" protocol={protocol} />
                      <span className="text-text2 dark:text-text2d">{protocol}</span>
                    </div>
                    <SwitchButton
                      active={protocols.includes(protocol)}
                      onChange={(active) => onToggleSwitch(protocol, active)}
                    />
                  </div>
                ))}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Transition>
    </Dialog>
  )
}
