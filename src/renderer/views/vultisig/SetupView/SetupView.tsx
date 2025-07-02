import { useCallback } from 'react'
import clsx from 'clsx'

import { useNavigate } from 'react-router-dom'
import { Label } from '../../../components/uielements/label'
import * as vultisigRoutes from '../../../routes/vultisig'

export const VultisigSetupView = () => {
  const navigate = useNavigate()

  const handleFastVault = useCallback(() => {
    navigate(vultisigRoutes.setupFastVault.path())
  }, [navigate])

  const handleImportVault = useCallback(() => {
    navigate(vultisigRoutes.importVault.path())
  }, [navigate])

  return (
    <div
      className={clsx('flex flex-col h-full items-center justify-center p-8 gap-4', 'bg-bg0 dark:bg-bg0d rounded-lg')}>
      <div
        className="cursor-pointer border border-solid border-gray0 dark:border-gray0d p-8 max-w-96 w-full rounded-lg hover:bg-gray0 hover:dark:bg-gray0d"
        onClick={handleFastVault}>
        <Label align="center" size="large">
          Fast Vault
        </Label>
      </div>
      <div className="cursor-pointer border border-solid border-gray0 dark:border-gray0d p-8 max-w-96 w-full rounded-lg hover:bg-gray0 hover:dark:bg-gray0d">
        <Label align="center" size="large">
          Secure Vault
        </Label>
      </div>
      <div
        className="cursor-pointer border border-solid border-gray0 dark:border-gray0d p-8 max-w-96 w-full rounded-lg hover:bg-gray0 hover:dark:bg-gray0d"
        onClick={handleImportVault}>
        <Label align="center" size="large">
          Import
        </Label>
      </div>
    </div>
  )
}
