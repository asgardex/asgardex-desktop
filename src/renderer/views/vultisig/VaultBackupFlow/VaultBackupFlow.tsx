import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { FlatButton } from '../../../components/uielements/button'
import { Label } from '../../../components/uielements/label'
import * as vultisigRoutes from '../../../routes/vultisig'
import { useBackupVaultMutation } from '../../../vultisig/core/ui/vault/mutations/useBackupVaultMutation'

export const VaultBackupFlow = () => {
  const navigate = useNavigate()

  const { mutate: backupVault } = useBackupVaultMutation({
    onSuccess: () => {
      navigate(vultisigRoutes.vault.path())
    }
  })

  return (
    <div
      className={clsx('flex flex-col h-full items-center justify-center p-8 gap-4', 'bg-bg0 dark:bg-bg0d rounded-lg')}>
      <Label align="center" size="large">
        Backup
      </Label>
      <div className="flex flex-col items-center justify-center gap-4 max-w-96 w-full">
        <FlatButton onClick={() => backupVault({})}>Backup without password</FlatButton>
        <FlatButton disabled>Use password</FlatButton>
      </div>
    </div>
  )
}
