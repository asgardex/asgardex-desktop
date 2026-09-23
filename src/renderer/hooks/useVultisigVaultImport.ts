import { useCallback, useState } from 'react'

import { useWalletContext } from '../contexts/WalletContext'
import { createScopedLogger } from '../helpers/logger'

const logger = createScopedLogger('VultisigImport')

type PasswordMode = 'file' | 'existing'

export const useVultisigVaultImport = (onActivated?: () => void) => {
  const { appWalletService } = useWalletContext()
  const vaultManager = appWalletService.vaultManager

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('file')
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
      const activated = await appWalletService.openImportedVault(vault.id)
      setShowPasswordModal(false)
      setPendingVaultFile(null)
      setPendingExistingUnlock(null)
      setPasswordMode('file')
      setShowReplaceConfirm(false)
      setPendingReplace(null)
      if (!activated) {
        logger.error('Imported vault is not active:', vault.id)
        // Activation failed; do not call onActivated.
        return
      }
      onActivated?.()
    },
    [appWalletService, onActivated]
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

  const importVault = useCallback(async () => {
    try {
      const result = await vaultManager.openVaultFile()
      if (!result) return

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
          await vaultManager.unlockStoredVault(pendingExistingUnlock.vaultId, password)
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
        // Rethrow so the password modal can show an invalid password.
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
      await applyImportedVault(vault)
    } catch (error) {
      logger.error('Failed to import vault:', error)
    }
  }, [pendingReplace, vaultManager, applyImportedVault])

  const handleReplaceConfirmClose = useCallback(() => {
    setShowReplaceConfirm(false)
    setPendingReplace(null)
  }, [])

  const passwordSubject =
    passwordMode === 'existing' ? pendingExistingUnlock?.vaultId || '' : pendingVaultFile?.filename || ''

  return {
    importVault,
    showPasswordModal,
    passwordMode,
    passwordSubject,
    handlePasswordSubmit,
    handlePasswordModalClose,
    showReplaceConfirm,
    handleReplaceConfirm,
    handleReplaceConfirmClose
  }
}
