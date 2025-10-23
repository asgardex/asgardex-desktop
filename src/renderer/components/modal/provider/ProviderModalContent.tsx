import { useCallback } from 'react'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useAggregator } from '../../../store/aggregator/hooks'
import { ProviderIcon } from '../../swap/ProviderIcon'
import { BaseButton } from '../../uielements/button'
import { SwitchButton } from '../../uielements/button/SwitchButton'

export type Props = {
  open: boolean
  onClose: FP.Lazy<void>
}

const AllProtocols: Protocol[] = ['Thorchain', 'Mayachain', 'Chainflip']

export const ProviderModalContent = ({ open, onClose }: Props) => {
  const { protocols, setAggProtocol } = useAggregator()
  const intl = useIntl()

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
            <h1 className="my-0 text-center text-xl uppercase text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'modal.provider.selectProtocols.title' })}
            </h1>
            <BaseButton
              className="!p-0 text-gray1 hover:text-gray2 focus:outline-none focus:ring-0 dark:text-gray1d hover:dark:text-gray2d"
              onClick={onCloseMenu}>
              <XMarkIcon className="h-20px w-20px text-inherit" />
            </BaseButton>
          </div>
          <span className="mt-2 px-5 text-sm text-gray1 dark:text-gray1d">
            Choose which protocols to consider when finding optimal swap routes.
          </span>
          <div className="mt-4 flex w-full flex-col gap-2 px-4">
            {AllProtocols.map((protocol) => (
              <div key={protocol} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ProviderIcon className="h-8 w-8" protocol={protocol} />
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
