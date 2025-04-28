import React from 'react'

import { Listbox } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { KeystoreId } from '../../../../shared/api/types'
import { KeystoreWalletsUI } from '../../../services/wallet/types'

export type Props = {
  wallets: KeystoreWalletsUI
  onChange: (id: KeystoreId) => void
  className?: string
  buttonClassName?: string
  disabled?: boolean
}

export const WalletSelector: React.FC<Props> = (props): JSX.Element => {
  const { wallets, onChange, disabled = false, className = '', buttonClassName = '' } = props

  const oSelectedWallet = FP.pipe(
    wallets,
    // get selected wallet
    A.findFirst(({ selected }) => selected),
    // use first if no wallet is selected
    O.alt(() => A.head(wallets))
  )

  return FP.pipe(
    oSelectedWallet,
    O.fold(
      () => <>No wallets</>,
      (selectedWallet) => (
        <Listbox
          value={selectedWallet}
          disabled={disabled}
          onChange={({ id }) => {
            onChange(id)
          }}>
          <div className={clsx('relative', className)}>
            <Listbox.Button
              as="div"
              className={clsx(
                'group flex cursor-pointer items-center',
                'bg-bg0 py-2 pl-3 pr-10px dark:bg-bg0d',
                'border border-solid border-gray0 dark:border-gray0d',
                'font-main text-14 text-text0 dark:text-text0d',
                'transition duration-300 ease-in-out',
                { 'opacity-70': disabled },
                buttonClassName
              )}>
              {({ open }) => (
                <>
                  <span className="w-full">{selectedWallet.name}</span>
                  <ChevronDownIcon
                    className={clsx('ease h-20px w-20px group-hover:rotate-180', { 'rotate-180': open })}
                  />
                </>
              )}
            </Listbox.Button>
            <Listbox.Options
              className={clsx(
                'absolute z-[2000] mt-0 max-h-60 w-full overflow-auto',
                'border border-gray0 bg-bg0 focus:outline-none dark:border-gray0d dark:bg-bg0d'
              )}>
              {FP.pipe(
                wallets,
                A.map((wallet) => {
                  const selected = wallet.id === selectedWallet.id
                  return (
                    <Listbox.Option
                      disabled={wallet.id === selectedWallet.id}
                      className={({ selected }) =>
                        clsx(
                          'flex w-full select-none items-center justify-between',
                          'py-10px pl-20px pr-10px',
                          'font-main text-14 text-text0 dark:text-text0d',
                          selected ? 'cursor-disabled text-text2 dark:text-text2d' : 'cursor-pointer',
                          selected ? '' : 'hover:bg-gray0 hover:text-text2 hover:dark:bg-gray0d hover:dark:text-text2d'
                        )
                      }
                      key={wallet.id}
                      value={wallet}>
                      {wallet.name}
                      {selected && <CheckIcon className="h-20px w-20px text-turquoise" />}
                    </Listbox.Option>
                  )
                })
              )}
            </Listbox.Options>
          </div>
        </Listbox>
      )
    )
  )
}
