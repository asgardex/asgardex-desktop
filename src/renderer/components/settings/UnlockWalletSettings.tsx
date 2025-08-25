import { useCallback } from 'react'
import { CpuChipIcon } from '@heroicons/react/24/outline'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import * as walletRoutes from '../../routes/wallet'
import { KeystoreState } from '../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../services/wallet/util'
import { FlatButton, BorderButton } from '../uielements/button'

type Props = {
  keystoreState: KeystoreState
  unlockHandler: FP.Lazy<void>
}

export const UnlockWalletSettings = ({ keystoreState, unlockHandler }: Props): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()

  const handleLedgerModeClick = useCallback(() => {
    navigate(walletRoutes.ledgerChainSelect.path())
  }, [navigate])

  return (
    <div className="flex flex-col items-center justify-center gap-4 bg-bg0 px-40px py-30px dark:bg-bg0d">
      <FlatButton className="min-w-[200px] px-30px" onClick={unlockHandler}>
        {!hasImportedKeystore(keystoreState)
          ? intl.formatMessage({ id: 'wallet.add.label' })
          : isLocked(keystoreState) && intl.formatMessage({ id: 'wallet.unlock.label' })}
      </FlatButton>

      <div className="flex items-center gap-2 text-text2 dark:text-text2d">
        <span className="text-sm">or</span>
      </div>

      <BorderButton size="normal" onClick={handleLedgerModeClick} className="flex items-center gap-2 min-w-[200px]">
        <CpuChipIcon className="h-5 w-5" />
        Enter Ledger Mode
      </BorderButton>
    </div>
  )
}
