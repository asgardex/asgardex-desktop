import { useCallback, useEffect } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
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
  midgardStatusRD: RD.RemoteData<Error, boolean>
  midgardStatusMayaRD: RD.RemoteData<Error, boolean>
}

const AllProtocols: Protocol[] = ['Thorchain', 'Mayachain', 'Chainflip']

export const ProviderModalContent = ({ open, onClose, midgardStatusRD, midgardStatusMayaRD }: Props) => {
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

  // Programmatically toggle protocols off if API is offline or failed
  useEffect(() => {
    if (RD.isFailure(midgardStatusRD)) {
      setAggProtocol('Thorchain', false)
    }
    if (RD.isFailure(midgardStatusMayaRD)) {
      setAggProtocol('Mayachain', false)
    }
  }, [midgardStatusRD, midgardStatusMayaRD, setAggProtocol])

  return (
    <Dialog as="div" className="relative z-10" open={open} onClose={onCloseMenu}>
      <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
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
              <div key={protocol} className="flex items-center justify-between">
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
        </DialogPanel>
      </div>
    </Dialog>
  )
}
