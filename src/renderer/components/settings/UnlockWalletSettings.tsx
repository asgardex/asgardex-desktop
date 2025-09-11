import { useCallback } from 'react'
import { CpuChipIcon } from '@heroicons/react/24/outline'
import { function as FP, option as O } from 'fp-ts'
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

  // Check if keystore is currently unlocked
  const isUnlocked = FP.pipe(
    keystoreState,
    O.map(isKeystoreUnlocked),
    O.getOrElse(() => false)
  )

  const handleUnlockClick = useCallback(() => {
    // Switch to keystore mode when clicking unlock (exits ledger mode if active)
    appWalletService.switchToKeystoreMode()
    // Then navigate to unlock
    unlockHandler()
  }, [appWalletService, unlockHandler])

  const handleLedgerModeClick = useCallback(() => {
    if (!isUnlocked) {
      navigate(walletRoutes.ledgerChainSelect.path())
    }
  }, [navigate, isUnlocked])

  return (
    <div className="flex flex-col items-center justify-center gap-4 bg-bg0 px-40px py-30px dark:bg-bg0d">
      <FlatButton className="min-w-[200px] px-30px" onClick={handleUnlockClick}>
        {!hasImportedKeystore(keystoreState)
          ? intl.formatMessage({ id: 'wallet.add.label' })
          : isLocked(keystoreState) && intl.formatMessage({ id: 'wallet.unlock.label' })}
      </FlatButton>

      <div className="flex items-center gap-2 text-text2 dark:text-text2d">
        <span className="text-sm">or</span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <BorderButton
          size="normal"
          onClick={handleLedgerModeClick}
          disabled={isUnlocked}
          className={`flex items-center gap-2 min-w-[200px] ${isUnlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isUnlocked ? 'Lock wallet to enter Ledger mode' : 'Enter Ledger Mode'}>
          <CpuChipIcon className="h-5 w-5" />
          Enter Ledger Mode
        </BorderButton>
        {isUnlocked && (
          <span className="text-warning0 dark:text-warning0d text-xs">
            {intl.formatMessage({ id: 'settings.ledgerMode.lockWalletWarning' })}
          </span>
        )}
      </div>
    </div>
  )
}
