import { useCallback } from 'react'

import { CpuChipIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { useWalletContext } from '../../contexts/WalletContext'
import * as walletRoutes from '../../routes/wallet'
import { KeystoreState, isKeystoreUnlocked } from '../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../services/wallet/util'
import { FlatButton, BorderButton } from '../uielements/button'

type Props = {
  keystoreState: KeystoreState
  unlockHandler: FP.Lazy<void>
}

export const UnlockWalletSettings = ({ keystoreState, unlockHandler }: Props): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { appWalletService } = useWalletContext()

  // Vultisig vault state
  const vultisigState = useObservableState(appWalletService.vaultManager.vultisigState$, {
    mode: 'standalone-vultisig' as const,
    phase: 'vault-selection' as const,
    availableVaults: [],
    activeVault: null,
    addresses: {}
  })

  const hasVultisigVaults = vultisigState.availableVaults.length > 0

  // Check if keystore is currently unlocked
  const isUnlocked = FP.pipe(
    keystoreState,
    O.map(isKeystoreUnlocked),
    O.getOrElse(() => false)
  )

  const hasKeystore = hasImportedKeystore(keystoreState)
  const keystoreLocked = isLocked(keystoreState)

  const handleKeystoreUnlockClick = useCallback(() => {
    appWalletService.switchToKeystoreMode()
    unlockHandler()
  }, [appWalletService, unlockHandler])

  const handleVultisigUnlockClick = useCallback(() => {
    appWalletService.switchToVultisigMode(true)
    unlockHandler()
  }, [appWalletService, unlockHandler])

  const handleLedgerModeClick = useCallback(() => {
    if (!isUnlocked) {
      navigate(walletRoutes.ledgerChainSelect.path())
    }
  }, [navigate, isUnlocked])

  return (
    <div className="flex flex-col items-center justify-center gap-4 bg-bg0 px-40px py-30px dark:bg-bg0d">
      {/* Keystore unlock / add */}
      <FlatButton className="min-w-[200px] px-30px" onClick={handleKeystoreUnlockClick}>
        {!hasKeystore
          ? intl.formatMessage({ id: 'wallet.add.label' })
          : keystoreLocked && intl.formatMessage({ id: 'wallet.unlock.label' })}
      </FlatButton>

      {/* Vultisig unlock — only shown if vaults exist */}
      {hasVultisigVaults && (
        <>
          <div className="flex items-center gap-2 text-text2 dark:text-text2d">
            <span className="text-sm">or</span>
          </div>
          <BorderButton
            size="normal"
            onClick={handleVultisigUnlockClick}
            className="flex min-w-[200px] items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5" />
            Unlock Vultisig Vault
          </BorderButton>
        </>
      )}

      {/* Ledger mode */}
      <div className="flex items-center gap-2 text-text2 dark:text-text2d">
        <span className="text-sm">or</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <BorderButton
          size="normal"
          onClick={handleLedgerModeClick}
          disabled={isUnlocked}
          className={`flex min-w-[200px] items-center gap-2 ${isUnlocked ? 'cursor-not-allowed opacity-50' : ''}`}
          title={isUnlocked ? 'Lock wallet to enter Ledger mode' : 'Enter Ledger Mode'}>
          <CpuChipIcon className="h-5 w-5" />
          Enter Ledger Mode
        </BorderButton>
        {isUnlocked && (
          <span className="text-xs text-warning0 dark:text-warning0d">
            {intl.formatMessage({ id: 'settings.ledgerMode.lockWalletWarning' })}
          </span>
        )}
      </div>
    </div>
  )
}
