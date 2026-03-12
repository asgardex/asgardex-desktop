import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { array as A, function as FP, option as O } from 'fp-ts'

import { KeystoreId } from '../../../../shared/api/types'
import { WalletType } from '../../../../shared/wallet/types'
import { KeystoreWalletsUI, VultisigVaultInfo } from '../../../services/wallet/types'

// Local type for dropdown items - includes `selected` state for UI
// Note: Different from centralized `Wallet` type which has no `selected` property
type WalletSelectorItem =
  | { type: WalletType.Keystore; id: KeystoreId; name: string; selected: boolean }
  | { type: WalletType.Vultisig; id: string; name: string; selected: boolean }

export type Props = {
  wallets: KeystoreWalletsUI
  vultisigVaults?: VultisigVaultInfo[]
  activeVultisigVaultId?: string | null
  onChange: (id: KeystoreId) => void
  onVultisigSelect?: (vaultId: string) => void
  className?: string
  buttonClassName?: string
  disabled?: boolean
}

export const WalletSelector = ({
  wallets,
  vultisigVaults = [],
  activeVultisigVaultId,
  onChange,
  onVultisigSelect,
  disabled = false,
  className = '',
  buttonClassName = ''
}: Props): JSX.Element => {
  // Combine keystore wallets and Vultisig vaults into unified list
  const allWallets: WalletSelectorItem[] = [
    ...wallets.map(({ id, name, selected }) => ({
      type: WalletType.Keystore as const,
      id,
      name,
      selected: activeVultisigVaultId ? false : selected // Deselect keystore if Vultisig is active
    })),
    ...vultisigVaults.map((v) => ({
      type: WalletType.Vultisig as const,
      id: v.id,
      name: v.name,
      selected: v.id === activeVultisigVaultId
    }))
  ]

  const oSelectedWallet = FP.pipe(
    allWallets,
    // get selected wallet
    A.findFirst(({ selected }) => selected),
    // use first if no wallet is selected
    O.alt(() => A.head(allWallets))
  )

  const handleChange = (wallet: WalletSelectorItem) => {
    if (wallet.type === WalletType.Keystore) {
      onChange(wallet.id)
    } else if (onVultisigSelect) {
      onVultisigSelect(wallet.id)
    }
  }

  return FP.pipe(
    oSelectedWallet,
    O.fold(
      () => <>No wallets</>,
      (selectedWallet) => (
        <Listbox value={selectedWallet} disabled={disabled} onChange={handleChange}>
          <div className={clsx('relative', className)}>
            <ListboxButton
              as="div"
              className={clsx(
                'group flex cursor-pointer items-center rounded-lg',
                'bg-bg0 py-2 pr-10px pl-3 dark:bg-bg0d',
                'border border-solid border-gray0 dark:border-gray0d',
                'font-main text-14 text-text0 dark:text-text0d',
                'transition duration-300 ease-in-out',
                { 'opacity-70': disabled },
                buttonClassName
              )}>
              {({ open }) => (
                <>
                  <span className="flex w-full items-center">
                    {selectedWallet.name}
                    {selectedWallet.type === WalletType.Vultisig && (
                      <span className="text-10 ml-1 text-turquoise">(V)</span>
                    )}
                  </span>
                  <ChevronDownIcon
                    className={clsx('ease h-20px w-20px group-hover:rotate-180', { 'rotate-180': open })}
                  />
                </>
              )}
            </ListboxButton>
            <ListboxOptions
              className={clsx(
                'absolute z-[2000] mt-0.5 max-h-60 w-full overflow-auto rounded-lg',
                'border border-gray0 bg-bg0 focus:outline-hidden dark:border-gray0d dark:bg-bg0d'
              )}>
              {FP.pipe(
                allWallets,
                A.map((wallet) => {
                  const isSelected = wallet.type === selectedWallet.type && wallet.id === selectedWallet.id
                  return (
                    <ListboxOption
                      disabled={isSelected}
                      className={({ selected }) =>
                        clsx(
                          'flex w-full items-center justify-between select-none',
                          'py-10px pr-10px pl-20px',
                          'font-main text-14 text-text0 dark:text-text0d',
                          selected ? 'cursor-disabled text-text2 dark:text-text2d' : 'cursor-pointer',
                          selected ? '' : 'hover:bg-gray0 hover:text-text2 dark:hover:bg-gray0d dark:hover:text-text2d'
                        )
                      }
                      key={`${wallet.type}-${wallet.id}`}
                      value={wallet}>
                      <span className="flex items-center">
                        {wallet.name}
                        {wallet.type === WalletType.Vultisig && (
                          <span className="text-10 ml-1 text-turquoise">(V)</span>
                        )}
                      </span>
                      {isSelected && <CheckIcon className="h-20px w-20px text-turquoise" />}
                    </ListboxOption>
                  )
                })
              )}
            </ListboxOptions>
          </div>
        </Listbox>
      )
    )
  )
}
