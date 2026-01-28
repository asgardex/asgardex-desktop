import { useEffect } from 'react'
import { useObservableState } from 'observable-hooks'
import { useNavigate } from 'react-router-dom'

import { UnlockForm } from '../../components/wallet/unlock'
import { useWalletContext } from '../../contexts/WalletContext'
import { useKeystoreState } from '../../hooks/useKeystoreState'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'
import * as walletRoutes from '../../routes/wallet'
import { isStandaloneVultisigMode } from '../../services/wallet/types'

export const UnlockView = (): JSX.Element => {
  const { state: keystore, unlock, remove, change$ } = useKeystoreState()
  const { walletsUI } = useKeystoreWallets()
  const { appWalletService } = useWalletContext()
  const navigate = useNavigate()

  // Get app wallet state to check if we're in Vultisig mode
  const appWalletState = useObservableState(appWalletService.appWalletState$, undefined)

  // Get Vultisig vaults
  const vultisigState = useObservableState(appWalletService.vaultManager.standaloneVultisigState$, {
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
      isStandaloneVultisigMode(appWalletState) &&
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
    appWalletService.switchToStandaloneVultisigMode(true)
    await appWalletService.vaultManager.selectVault(vaultId)
  }

  // Handler to unlock Vultisig vault with password
  const unlockVultisigVault = async (password: string) => {
    await appWalletService.vaultManager.unlockVault(password)
    // Navigation happens via useEffect when phase becomes 'active'
  }

  // Determine if we're showing Vultisig unlock screen
  const isVultisigLocked = vultisigState.phase === 'vault-locked' && vultisigState.activeVault !== null

  return (
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
    />
  )
}
