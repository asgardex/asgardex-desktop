import { useCallback, useMemo, useState } from 'react'

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon, PlusCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { WalletType } from '../../../../shared/wallet/types'
import { truncateMiddle } from '../../../helpers/stringHelper'
import * as walletRoutes from '../../../routes/wallet'
import { KeystoreState, Wallet, VaultManager } from '../../../services/wallet/types'
import { LockIcon, UnlockIcon } from '../../icons'
import { VaultPasswordModal } from '../../modal/VaultPasswordModal'
import { BaseButton } from '../../uielements/button'
import { Tooltip } from '../../uielements/tooltip'

// Phase D → 4F: Props simplified to use unified wallet API from appWalletService
export type Props = {
  keystoreState: KeystoreState
  lockHandler: FP.Lazy<void>
  isLocked: boolean
  // Phase D → 4F: Unified wallet props
  allWallets: Wallet[]
  activeWallet: O.Option<Wallet>
  selectWallet: (wallet: Wallet) => Promise<void>
  // VaultManager for import functionality
  vaultManager: VaultManager
}

export const HeaderLock = (props: Props): JSX.Element => {
  const {
    keystoreState: _keystoreState, // kept for potential future use
    lockHandler: onPress,
    isLocked,
    // Phase D: Unified wallet props from appWalletService
    allWallets,
    activeWallet: oSelectedWallet,
    selectWallet,
    vaultManager
  } = props

  const intl = useIntl()
  const navigate = useNavigate()

  const hasWallets = allWallets.length > 0

  // Vultisig vault import state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pendingVaultFile, setPendingVaultFile] = useState<{ content: string; filename: string } | null>(null)

  // Phase D → 4F: Selection handler simplified - just calls unified selectWallet
  const handleWalletChange = useCallback(
    (wallet: Wallet) => {
      selectWallet(wallet).catch((error) => {
        // UI handles error display
        window.apiLog.error('[HeaderLock]', 'Failed to select wallet:', error)
      })
    },
    [selectWallet]
  )

  // Import Vultisig vault from .vult file
  const importVaultHandler = useCallback(async () => {
    try {
      const result = await window.apiMpc.openVaultFile()
      if (!result) return // User canceled

      if (result.isEncrypted) {
        // Show password modal for encrypted vaults
        setPendingVaultFile({ content: result.content, filename: result.filename })
        setShowPasswordModal(true)
      } else {
        // Import unencrypted vault directly
        const vault = await window.apiMpc.importVault(result.content)
        await vaultManager.loadVaults()
        await vaultManager.selectVault(vault.id, false)
        navigate(walletRoutes.assets.template)
      }
    } catch (error) {
      window.apiLog.error('[HeaderLock]', 'Failed to import vault:', error)
    }
  }, [navigate, vaultManager])

  // Handle password submission for encrypted vault
  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      if (!pendingVaultFile) return

      const vault = await window.apiMpc.importVault(pendingVaultFile.content, password)
      await vaultManager.loadVaults()
      await vaultManager.selectVault(vault.id, false)
      setShowPasswordModal(false)
      setPendingVaultFile(null)
      navigate(walletRoutes.assets.template)
    },
    [pendingVaultFile, navigate, vaultManager]
  )

  const handlePasswordModalClose = useCallback(() => {
    setShowPasswordModal(false)
    setPendingVaultFile(null)
  }, [])

  const renderWallets = useMemo(
    () =>
      FP.pipe(
        oSelectedWallet,
        O.fold(
          () => <>no selected wallet</>,
          (selectedWallet) => (
            <div className="ease z-10 flex h-[25px] items-center rounded-full bg-bg0 drop-shadow dark:bg-gray0d">
              <div
                className="ease rounded-full border-4 border-bg0 bg-bg0 dark:border-gray0d dark:bg-gray0d"
                onClick={() => onPress()}>
                {isLocked ? (
                  <LockIcon className="h-[28px] w-[28px] cursor-pointer" />
                ) : (
                  <UnlockIcon className="h-[28px] w-[28px] cursor-pointer" />
                )}
              </div>
              <Listbox value={selectedWallet} onChange={handleWalletChange}>
                <div className="relative">
                  <ListboxButton
                    as="div"
                    className={clsx(
                      'group flex cursor-pointer items-center',
                      'font-main text-14 text-text1 dark:text-text1d',
                      'pl-5px pr-10px',
                      'transition duration-300 ease-in-out'
                    )}>
                    {({ open }) => (
                      <>
                        <span className="w-full">
                          {truncateMiddle(selectedWallet.name, { start: 3, end: 3, max: 6 })}
                        </span>
                        <ChevronDownIcon
                          className={clsx('ease h-20px w-20px group-hover:rotate-180', { 'rotate-180': open })}
                        />
                      </>
                    )}
                  </ListboxButton>
                  <ListboxOptions
                    className={clsx(
                      'absolute left-[-100px] top-[35px]',
                      'z-[2000] mt-1 max-h-60 w-[200px]',
                      'overflow-auto bg-bg0 dark:bg-bg0d',
                      'drop-shadow-lg focus:outline-none',
                      'rounded-md border border-solid border-gray0 dark:border-gray0d'
                    )}>
                    {FP.pipe(
                      allWallets,
                      A.map((wallet) => {
                        const selected = wallet.type === selectedWallet.type && wallet.id === selectedWallet.id
                        return (
                          <ListboxOption
                            disabled={selected}
                            className={({ selected }) =>
                              clsx(
                                'flex select-none items-center justify-between',
                                'px-20px py-10px',
                                'font-main text-14 text-text1 dark:text-text1d',
                                selected
                                  ? 'cursor-disabled text-gray2 dark:text-gray2d'
                                  : 'cursor-pointer hover:bg-gray0 hover:text-gray2 hover:dark:bg-gray0d hover:dark:text-gray2d'
                              )
                            }
                            key={`${wallet.type}-${wallet.id}`}
                            value={wallet}>
                            <span className="flex items-center">
                              {truncateMiddle(wallet.name, { start: 9, end: 9, max: 20 })}
                              {wallet.type === WalletType.Vultisig && (
                                <span className="text-10 ml-1 text-turquoise">(V)</span>
                              )}
                            </span>
                            {selected && <CheckIcon className="h-20px w-20px text-turquoise" />}
                          </ListboxOption>
                        )
                      })
                    )}
                    {/* Divider */}
                    <div className="my-1 border-t border-gray0 dark:border-gray0d" />
                    {/* Import vault option */}
                    <div
                      className={clsx(
                        'flex cursor-pointer select-none items-center',
                        'px-20px py-10px',
                        'font-main text-14 text-text1 dark:text-text1d',
                        'hover:bg-gray0 hover:text-gray2 hover:dark:bg-gray0d hover:dark:text-gray2d'
                      )}
                      onClick={importVaultHandler}>
                      <ArrowDownTrayIcon className="h-16px w-16px mr-2" />
                      {intl.formatMessage({ id: 'wallet.vultisig.import' })}
                    </div>
                  </ListboxOptions>
                </div>
              </Listbox>
            </div>
          )
        )
      ),

    [handleWalletChange, isLocked, oSelectedWallet, onPress, allWallets, intl, importVaultHandler]
  )

  const renderAddWallet = useMemo(
    () => (
      <Tooltip title={intl.formatMessage({ id: 'wallet.add.label' })}>
        <BaseButton className="!p-0 text-warning0" onClick={() => navigate(walletRoutes.noWallet.path())}>
          <PlusCircleIcon className="ml-5px h-[28px] w-[28px]" />
        </BaseButton>
      </Tooltip>
    ),
    [intl, navigate]
  )

  return (
    <>
      <div className="flex justify-center">{hasWallets ? renderWallets : renderAddWallet}</div>
      <VaultPasswordModal
        visible={showPasswordModal}
        filename={pendingVaultFile?.filename || ''}
        onSubmit={handlePasswordSubmit}
        onClose={handlePasswordModalClose}
      />
    </>
  )
}
