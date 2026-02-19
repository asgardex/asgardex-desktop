import { useCallback, useState } from 'react'

import { KeyIcon, CpuChipIcon, ShieldCheckIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import FolderKeyIcon from '../../../assets/svg/folder-key.svg?react'
import AsgardexLogo from '../../../assets/svg/logo-asgardex.svg?react'
import SproutIcon from '../../../assets/svg/sprout.svg?react'
import { HeaderTheme } from '../../../components/header/theme'
import { LocaleDropdown } from '../../../components/LayoutlessWrapper/LocaleDropdown'
import { VaultPasswordModal } from '../../../components/modal/VaultPasswordModal'
import { BackLinkButton } from '../../../components/uielements/button'
import { useWalletContext } from '../../../contexts/WalletContext'
import * as walletRoutes from '../../../routes/wallet'
import { hasImportedKeystore } from '../../../services/wallet/util'

export const NoWalletView = () => {
  const navigate = useNavigate()
  const intl = useIntl()
  const { keystoreService, appWalletService } = useWalletContext()
  const vaultManager = appWalletService.vaultManager

  const keystore = useObservableState(keystoreService.keystoreState$, undefined)

  // Vultisig vault import state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pendingVaultFile, setPendingVaultFile] = useState<{ content: string; filename: string } | null>(null)

  const createWalletHandler = useCallback(() => {
    navigate(walletRoutes.create.phrase.path())
  }, [navigate])

  const importKeystoreHandler = useCallback(() => {
    navigate(walletRoutes.imports.keystore.path())
  }, [navigate])

  const importPhraseHandler = useCallback(() => {
    navigate(walletRoutes.imports.phrase.path())
  }, [navigate])

  const useLedgerHandler = useCallback(() => {
    // Navigate directly to ledger chain selection
    navigate(walletRoutes.ledgerChainSelect.path())
  }, [navigate])

  const useVultisigHandler = useCallback(() => {
    // Navigate to vultisig fast vault creation (email verification)
    navigate(walletRoutes.vultisigCreate.path())
  }, [navigate])

  const useVultisigSecureHandler = useCallback(() => {
    // Navigate to vultisig secure vault creation (2-of-2 with phone)
    navigate(walletRoutes.vultisigSecureCreate.path())
  }, [navigate])

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
      window.apiLog.error('[NoWalletView]', 'Failed to import vault:', error)
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

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 bg-bg1 dark:bg-bg1d">
      {((keystore && hasImportedKeystore(keystore)) || vaultManager.vultisigState().availableVaults.length > 0) && (
        <div className="absolute left-4 top-4 z-10">
          <BackLinkButton />
        </div>
      )}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <LocaleDropdown />
        <HeaderTheme isDesktopView />
      </div>
      <div className="flex flex-col items-center justify-center">
        <AsgardexLogo className="[&>*]:fill-text1 [&>*]:dark:fill-text1d" />
        <span className="text-xs text-gray2 dark:text-gray2d">{intl.formatMessage({ id: 'common.welcome' })}</span>
      </div>
      <div className="flex flex-col gap-4">
        <div
          className={clsx(
            'flex items-center gap-4',
            'bg-bg2/50 hover:bg-bg2 dark:bg-bg2d/20 hover:dark:bg-bg2d/40',
            'cursor-pointer rounded-lg p-6 text-center transition duration-300 ease-in-out'
          )}
          onClick={createWalletHandler}>
          <KeyIcon className="text-gray-500" width={40} height={40} />
          <div className="flex flex-col items-start">
            <span className="text-lg text-text1 dark:text-text1d">
              {intl.formatMessage({ id: 'wallet.action.create' })} {intl.formatMessage({ id: 'common.keystore' })}
            </span>
            <span className="text-gray-500">{intl.formatMessage({ id: 'wallet.create.error.phrase.empty' })}</span>
          </div>
        </div>

        <div
          className={clsx(
            'flex items-center gap-4',
            'bg-bg2/50 hover:bg-bg2 dark:bg-bg2d/20 hover:dark:bg-bg2d/40',
            'cursor-pointer rounded-lg p-6 text-center transition duration-300 ease-in-out'
          )}
          onClick={importKeystoreHandler}>
          <FolderKeyIcon className="text-gray-500" width={40} height={40} />
          <div className="flex flex-col items-start">
            <span className="text-lg text-text1 dark:text-text1d">
              {intl.formatMessage({ id: 'wallet.action.import' })} {intl.formatMessage({ id: 'common.keystore' })}
            </span>
            <span className="text-gray-500">{intl.formatMessage({ id: 'wallet.imports.keystore.description' })}</span>
          </div>
        </div>

        <div
          className={clsx(
            'flex items-center gap-4',
            'bg-bg2/50 hover:bg-bg2 dark:bg-bg2d/20 hover:dark:bg-bg2d/40',
            'cursor-pointer rounded-lg p-6 text-center transition duration-300 ease-in-out'
          )}
          onClick={importPhraseHandler}>
          <SproutIcon className="text-gray-500" width={40} height={40} />
          <div className="flex flex-col items-start">
            <span className="text-lg text-text1 dark:text-text1d">
              {intl.formatMessage({ id: 'wallet.action.import' })} {intl.formatMessage({ id: 'common.phrase' })}
            </span>
            <span className="text-gray-500">{intl.formatMessage({ id: 'wallet.imports.phrase.description' })}</span>
          </div>
        </div>

        <div
          className={clsx(
            'flex items-center gap-4',
            'bg-bg2/50 hover:bg-bg2 dark:bg-bg2d/20 hover:dark:bg-bg2d/40',
            'cursor-pointer rounded-lg p-6 text-center transition duration-300 ease-in-out'
          )}
          onClick={useLedgerHandler}>
          <CpuChipIcon className="text-gray-500" width={40} height={40} />
          <div className="flex flex-col items-start">
            <span className="text-lg text-text1 dark:text-text1d">Use Ledger Device</span>
            <span className="text-gray-500">Connect your hardware wallet for secure trading</span>
          </div>
        </div>

        <div
          className={clsx(
            'flex items-center gap-4',
            'bg-bg2/50 hover:bg-bg2 dark:bg-bg2d/20 hover:dark:bg-bg2d/40',
            'cursor-pointer rounded-lg p-6 text-center transition duration-300 ease-in-out'
          )}
          onClick={useVultisigHandler}>
          <ShieldCheckIcon className="text-gray-500" width={40} height={40} />
          <div className="flex flex-col items-start">
            <span className="text-lg text-text1 dark:text-text1d">Use Vultisig Vault</span>
            <span className="text-gray-500">MPC threshold signature wallet - no seed phrase needed</span>
          </div>
        </div>

        <div
          className={clsx(
            'flex items-center gap-4',
            'bg-bg2/50 hover:bg-bg2 dark:bg-bg2d/20 hover:dark:bg-bg2d/40',
            'cursor-pointer rounded-lg p-6 text-center transition duration-300 ease-in-out'
          )}
          onClick={useVultisigSecureHandler}>
          <ShieldCheckIcon className="text-turquoise" width={40} height={40} />
          <div className="flex flex-col items-start">
            <span className="text-lg text-text1 dark:text-text1d">Create Secure Vault (2-of-2)</span>
            <span className="text-gray-500">Pair with Vultisig mobile app via QR code</span>
          </div>
        </div>

        <div
          className={clsx(
            'flex items-center gap-4',
            'bg-bg2/50 hover:bg-bg2 dark:bg-bg2d/20 hover:dark:bg-bg2d/40',
            'cursor-pointer rounded-lg p-6 text-center transition duration-300 ease-in-out'
          )}
          onClick={importVaultHandler}>
          <ArrowDownTrayIcon className="text-gray-500" width={40} height={40} />
          <div className="flex flex-col items-start">
            <span className="text-lg text-text1 dark:text-text1d">
              {intl.formatMessage({ id: 'wallet.vultisig.import' })}
            </span>
            <span className="text-gray-500">{intl.formatMessage({ id: 'wallet.vultisig.import.description' })}</span>
          </div>
        </div>
      </div>

      <VaultPasswordModal
        visible={showPasswordModal}
        filename={pendingVaultFile?.filename || ''}
        onSubmit={handlePasswordSubmit}
        onClose={handlePasswordModalClose}
      />
    </div>
  )
}
