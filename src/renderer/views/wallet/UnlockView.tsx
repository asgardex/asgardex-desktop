import { useCallback, useEffect, useState } from 'react'

import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { ConfirmationModal } from '../../components/modal/confirmation'
import { VaultPasswordModal } from '../../components/modal/VaultPasswordModal'
import { UnlockForm } from '../../components/wallet/unlock'
import { useWalletContext } from '../../contexts/WalletContext'
import { createScopedLogger } from '../../helpers/logger'
import { useKeystoreState } from '../../hooks/useKeystoreState'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'
import * as walletRoutes from '../../routes/wallet'
import { isVultisigMode, VultisigPhase } from '../../services/wallet/types'

const logger = createScopedLogger('UnlockView')

export const UnlockView = (): JSX.Element => {
  const { state: keystore, unlock, remove, change$ } = useKeystoreState()
  const { walletsUI } = useKeystoreWallets()
  const { appWalletService } = useWalletContext()
  const vaultManager = appWalletService.vaultManager
  const navigate = useNavigate()
  const intl = useIntl()

  // Get app wallet state to check if we're in Vultisig mode
  const appWalletState = useObservableState(appWalletService.appWalletState$, undefined)

  // Get Vultisig vaults
  const vultisigState = useObservableState(appWalletService.vaultManager.vultisigState$, {
    mode: 'standalone-vultisig' as const,
    phase: VultisigPhase.VaultSelection,
    availableVaults: [],
    activeVault: null,
    addresses: {}
  })

  // Navigate to assets when Vultisig vault becomes active (unlocked)
  // IMPORTANT: Only navigate if app is actually in Vultisig mode to prevent loops when switching wallet types
  useEffect(() => {
    if (
      appWalletState &&
      isVultisigMode(appWalletState) &&
      vultisigState.phase === VultisigPhase.Active &&
      vultisigState.activeVault
    ) {
      navigate(walletRoutes.assets.path())
    }
  }, [appWalletState, vultisigState.phase, vultisigState.activeVault, navigate])

  // (Removed: auto-unlock effect for unencrypted vaults in VaultLocked phase.
  //  It was a defensive workaround for a different bug. Now that lockVault
  //  intentionally puts unencrypted vaults in VaultLocked, this effect would
  //  bounce straight back to active and defeat the lock. Without it, the
  //  unencrypted vault stays locked until the user re-selects it from the
  //  wallet list — which calls selectVault and activates instantly because
  //  isVultisigLocked is false for unencrypted vaults so no password prompt
  //  shows.)

  // Handler to select a Vultisig vault
  // This will check if vault is locked and either:
  // - Set phase to 'vault-locked' if password needed (encrypted vaults)
  // - Set phase to 'active' directly (unencrypted vaults or newly created)
  const selectVultisigVault = async (vaultId: string) => {
    await appWalletService.switchToVultisigMode(true)
    await appWalletService.vaultManager.selectVault(vaultId)
  }

  // Handler to unlock Vultisig vault with password
  const unlockVultisigVault = async (password: string) => {
    await appWalletService.vaultManager.unlockVault(password)
    // Navigation happens via useEffect when phase becomes 'active'
  }

  // We're in the Vultisig unlock flow whenever the active vault is in VaultLocked
  // phase, regardless of encryption. UnlockForm uses `isVultisigVaultEncrypted`
  // (below) to decide whether to require a password input.
  const isVultisigLocked = vultisigState.phase === VultisigPhase.VaultLocked && vultisigState.activeVault !== null
  const isVultisigVaultEncrypted = vultisigState.activeVault?.isEncrypted ?? true

  // Vultisig vault import state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordMode, setPasswordMode] = useState<'file' | 'existing'>('file')
  const [pendingVaultFile, setPendingVaultFile] = useState<{ content: string; filename: string } | null>(null)
  const [pendingExistingUnlock, setPendingExistingUnlock] = useState<{
    vaultId: string
    content: string
    filePassword?: string
  } | null>(null)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [pendingReplace, setPendingReplace] = useState<{
    content: string
    password?: string
  } | null>(null)

  const applyImportedVault = useCallback(
    async (vault: { id: string }) => {
      await appWalletService.switchToVultisigMode(true)
      await vaultManager.loadVaults()
      await vaultManager.selectVault(vault.id, false)
      setShowPasswordModal(false)
      setPendingVaultFile(null)
      setPendingExistingUnlock(null)
      setPasswordMode('file')
      setShowReplaceConfirm(false)
      setPendingReplace(null)
      navigate(walletRoutes.assets.path())
    },
    [appWalletService, vaultManager, navigate]
  )

  const handleExistingLocked = useCallback((content: string, filePassword: string | undefined, vaultId?: string) => {
    if (!vaultId) {
      logger.error('EXISTING_VAULT_PASSWORD_REQUIRED without vaultId')
      return
    }
    setPendingExistingUnlock({ vaultId, content, filePassword })
    setPasswordMode('existing')
    setShowPasswordModal(true)
  }, [])

  // Import Vultisig vault from .vult file
  const importVaultHandler = useCallback(async () => {
    try {
      const result = await vaultManager.openVaultFile()
      if (!result) return // User canceled

      if (result.isEncrypted) {
        setPasswordMode('file')
        setPendingVaultFile({ content: result.content, filename: result.filename })
        setShowPasswordModal(true)
      } else {
        const imported = await vaultManager.importVault(result.content)
        if (imported.status === 'existing-locked') {
          handleExistingLocked(result.content, undefined, imported.vaultId)
          return
        }
        if (imported.status === 'duplicate') {
          setPendingReplace({ content: result.content })
          setShowReplaceConfirm(true)
          return
        }
        await applyImportedVault(imported.vault)
      }
    } catch (error) {
      logger.error('Failed to import vault:', error)
    }
  }, [vaultManager, handleExistingLocked, applyImportedVault])

  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      try {
        if (passwordMode === 'existing') {
          if (!pendingExistingUnlock) return
          await window.apiMpc.unlockVault(pendingExistingUnlock.vaultId, password)
          const imported = await vaultManager.importVault(
            pendingExistingUnlock.content,
            pendingExistingUnlock.filePassword
          )
          if (imported.status === 'existing-locked') {
            throw new Error('Existing vault is still locked')
          }
          if (imported.status === 'duplicate') {
            setPendingReplace({
              content: pendingExistingUnlock.content,
              password: pendingExistingUnlock.filePassword
            })
            setShowPasswordModal(false)
            setShowReplaceConfirm(true)
            return
          }
          await applyImportedVault(imported.vault)
          return
        }

        if (!pendingVaultFile) return
        const imported = await vaultManager.importVault(pendingVaultFile.content, password)
        if (imported.status === 'existing-locked') {
          handleExistingLocked(pendingVaultFile.content, password, imported.vaultId)
          return
        }
        if (imported.status === 'duplicate') {
          setPendingReplace({ content: pendingVaultFile.content, password })
          setShowPasswordModal(false)
          setShowReplaceConfirm(true)
          return
        }
        await applyImportedVault(imported.vault)
      } catch (error) {
        logger.error('Failed to import vault with password:', error)
        throw error
      }
    },
    [passwordMode, pendingExistingUnlock, pendingVaultFile, vaultManager, handleExistingLocked, applyImportedVault]
  )

  const handlePasswordModalClose = useCallback(() => {
    setShowPasswordModal(false)
    setPendingVaultFile(null)
    setPendingExistingUnlock(null)
    setPasswordMode('file')
  }, [])

  const handleReplaceConfirm = useCallback(async () => {
    if (!pendingReplace) return

    try {
      const vault = await vaultManager.importVaultReplace(pendingReplace.content, pendingReplace.password)
      await appWalletService.switchToVultisigMode(true)
      await vaultManager.loadVaults()
      await vaultManager.selectVault(vault.id, false)
      setShowPasswordModal(false)
      setPendingVaultFile(null)
      setShowReplaceConfirm(false)
      setPendingReplace(null)
      navigate(walletRoutes.assets.path())
    } catch (error) {
      logger.error('Failed to import vault:', error)
    }
  }, [pendingReplace, navigate, appWalletService, vaultManager])

  const handleReplaceConfirmClose = useCallback(() => {
    setShowReplaceConfirm(false)
    setPendingReplace(null)
  }, [])

  return (
    <>
      <UnlockForm
        keystore={keystore}
        unlock={unlock}
        removeKeystore={remove}
        changeKeystore$={change$}
        wallets={walletsUI}
        vultisigVaults={vultisigState.availableVaults}
        activeVultisigVaultId={vultisigState.activeVault?.id ?? null}
        onVultisigSelect={selectVultisigVault}
        isVultisigLocked={isVultisigLocked}
        isVultisigVaultEncrypted={isVultisigVaultEncrypted}
        onVultisigUnlock={unlockVultisigVault}
        vultisigError={vultisigState.error}
        onVultisigImport={importVaultHandler}
      />
      <VaultPasswordModal
        visible={showPasswordModal}
        subject={passwordMode === 'existing' ? pendingExistingUnlock?.vaultId || '' : pendingVaultFile?.filename || ''}
        onSubmit={handlePasswordSubmit}
        onClose={handlePasswordModalClose}
      />
      <ConfirmationModal
        visible={showReplaceConfirm}
        content={intl.formatMessage({ id: 'wallet.vultisig.import.error.duplicate' })}
        onSuccess={handleReplaceConfirm}
        onClose={handleReplaceConfirmClose}
      />
    </>
  )
}
