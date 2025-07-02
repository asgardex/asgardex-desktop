import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as vultisigRoutes from '../../../routes/vultisig'
import { useVaultBackupOverride } from '../../../vultisig/core/ui/vault/state/vaultBackupOverride'
import { Vault } from '../../../vultisig/core/ui/vault/Vault'
import { ValueProp } from '../../../vultisig/lib/ui/props'
import { SaveVaultStep } from './SaveVaultStep'

export const SaveImportedVaultStep = ({ value }: ValueProp<Vault>) => {
  console.log('SAVE IMPORTED VAULT STEP')
  const navigate = useNavigate()
  const override = useVaultBackupOverride()

  const finalValue = useMemo(
    () => ({
      ...(override ? { ...value, ...override } : value),
      order: 0
    }),
    [override, value]
  )

  return (
    <SaveVaultStep
      onBack={() => navigate(vultisigRoutes.vault.path())}
      onFinish={() => navigate(vultisigRoutes.vault.path())}
      value={finalValue}
      title="Import Vault"
    />
  )
}
