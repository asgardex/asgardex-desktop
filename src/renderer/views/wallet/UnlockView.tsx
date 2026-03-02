import { useCallback, useEffect, useState } from 'react'

import { useObservableState } from 'observable-hooks'
import { useNavigate } from 'react-router-dom'

import { VaultPasswordModal } from '../../components/modal/VaultPasswordModal'
import { UnlockForm } from '../../components/wallet/unlock'
import { useWalletContext } from '../../contexts/WalletContext'
import { useKeystoreState } from '../../hooks/useKeystoreState'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'
import * as walletRoutes from '../../routes/wallet'
import { isVultisigMode } from '../../services/wallet/types'

export const UnlockView = (): JSX.Element => {
  const { state: keystore, unlock, remove, change$ } = useKeystoreState()
  const { walletsUI } = useKeystoreWallets()
  const { appWalletService } = useWalletContext()
  const navigate = useNavigate()

  // Get app wallet state to check if we're in Vultisig mode
  const appWalletState = useObservableState(appWalletService.appWalletState$, undefined)

  // Get Vultisig vaults
  const vultisigState = useObservableState(appWalletService.vaultManager.vultisigState$, {
    mode: 'standalone-vultisig' as const,
    phase: 'vault-selection' as const,
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
      vultisigState.phase === 'active' &&
      vultisigState.activeVault
    ) {
      navigate(walletRoutes.assets.path())
    }
  }, [appWalletState, vultisigState.phase, vultisigState.activeVault, navigate])

  // Handler to select a Vultisig vault
  // This will check if vault is locked and either:
  // - Set phase to 'vault-locked' if password needed
  // - Set phase to 'active' if already unlocked (then useEffect navigates)
  const selectVultisigVault = async (vaultId: string) => {
    appWalletService.switchToVultisigMode(true)
    await appWalletService.vaultManager.selectVault(vaultId)
  }

  // Handler to unlock Vultisig vault with password
  const unlockVultisigVault = async (password: string) => {
    await appWalletService.vaultManager.unlockVault(password)
    // Navigation happens via useEffect when phase becomes 'active'
  }

  // Determine if we're showing Vultisig unlock screen
  const isVultisigLocked = vultisigState.phase === 'vault-locked' && vultisigState.activeVault !== null

  // Vultisig vault import state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pendingVaultFile, setPendingVaultFile] = useState<{ content: string; filename: string } | null>(null)

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
        await appWalletService.vaultManager.loadVaults()
        await appWalletService.vaultManager.selectVault(vault.id, false)
        navigate(walletRoutes.assets.path())
      }
    } catch (error) {
      window.apiLog.error('[UnlockView]', 'Failed to import vault:', error)
    }
  }, [navigate, appWalletService.vaultManager])

  // Handle password submission for encrypted vault
  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      if (!pendingVaultFile) return

      const vault = await window.apiMpc.importVault(pendingVaultFile.content, password)
      await appWalletService.vaultManager.loadVaults()
      await appWalletService.vaultManager.selectVault(vault.id, false)
      setShowPasswordModal(false)
      setPendingVaultFile(null)
      navigate(walletRoutes.assets.path())
    },
    [pendingVaultFile, navigate, appWalletService.vaultManager]
  )

  const handlePasswordModalClose = useCallback(() => {
    setShowPasswordModal(false)
    setPendingVaultFile(null)
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
        onVultisigUnlock={unlockVultisigVault}
        vultisigError={vultisigState.error}
        onVultisigImport={importVaultHandler}
      />
      <VaultPasswordModal
        visible={showPasswordModal}
        filename={pendingVaultFile?.filename || ''}
        onSubmit={handlePasswordSubmit}
        onClose={handlePasswordModalClose}
      />
    </>
  )
}
