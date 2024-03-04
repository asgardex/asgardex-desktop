import React from 'react'

import { Listbox } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { KeystoreId } from '../../../../shared/api/types'
import { KeystoreWalletsUI } from '../../../services/wallet/types'

export type Props = {
  wallets: KeystoreWalletsUI
  onChange: (id: KeystoreId) => void
  className?: string
  disabled?: boolean
}

export const WalletSelector: React.FC<Props> = (props): JSX.Element => {
  const { wallets, onChange, disabled = false, className = '' } = props

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
          <div className={`relative ${className}`}>
            <Listbox.Button
              as="div"
              className={({ open }) => `group
              flex
              cursor-pointer items-center
              bg-bg0
                    py-10px
                    pl-20px
                    pr-10px
                   font-main text-14
                   text-text0
                    transition
                    duration-300
                    ease-in-out hover:shadow-full
                    hover:dark:shadow-fulld
                    ${disabled && 'opacity-70'}
                    ${open ? 'shadow-full dark:shadow-fulld' : ''}
                    dark:bg-bg0d
                    dark:text-text0d
                    `}>
              {({ open }) => (
                <>
                  <span className="w-full">{selectedWallet.name}</span>
                  <ChevronDownIcon
                    className={`
                  ${open && 'rotate-180'}
                  ease
                  h-20px w-20px
                          group-hover:rotate-180

                  `}
                  />
                </>
              )}
            </Listbox.Button>
            <Listbox.Options
              className="
              absolute z-[2000]
              mt-[0px]
            max-h-60 w-full overflow-auto
            border
            border-gray0 bg-bg0
            focus:outline-none
            dark:border-gray0d  dark:bg-bg0d
            ">
              {FP.pipe(
                wallets,
                A.map((wallet) => {
                  const selected = wallet.id === selectedWallet.id
                  return (
                    <Listbox.Option
                      disabled={wallet.id === selectedWallet.id}
                      className={({ selected }) =>
                        `flex w-full
                      select-none
                      items-center justify-between
                      py-10px pl-20px pr-10px
                      ${selected && 'text-gray2 dark:text-gray2d'}
                      ${selected ? 'cursor-disabled' : 'cursor-pointer'}
                      font-main text-14 text-text0
                      dark:text-text0d
                      ${!selected && 'hover:bg-gray0 hover:text-gray2'}
                      ${!selected && 'hover:dark:bg-gray0d hover:dark:text-gray2d'}
                      `
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
