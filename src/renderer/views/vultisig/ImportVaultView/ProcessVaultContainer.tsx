import { fromBinary } from '@bufbuild/protobuf'
import { fromCommVault } from '../../../vultisig/core/mpc/types/utils/commVault'
import { VaultContainer } from '../../../vultisig/core/mpc/types/vultisig/vault/v1/vault_container_pb'
import { VaultSchema } from '../../../vultisig/core/mpc/types/vultisig/vault/v1/vault_pb'
import { Vault } from '../../../vultisig/core/ui/vault/Vault'
import { ValueTransfer } from '../../../vultisig/lib/ui/base/ValueTransfer'
import { fromBase64 } from '../../../vultisig/lib/utils/fromBase64'
import { pipe } from '../../../vultisig/lib/utils/pipe'
import { DecryptVaultContainerStep } from './DecryptVaultContainerStep'

import { SaveImportedVaultStep } from './SaveImportedVaultStep'

export const ProcessVaultContainer = ({ value }: { value: VaultContainer }) => {
  console.log('PROCESS VAULT CONTAINER')
  const { vault: vaultAsBase64String, isEncrypted } = value
  if (isEncrypted) {
    return (
      <ValueTransfer<Vault>
        from={({ onFinish }) => <DecryptVaultContainerStep value={vaultAsBase64String} onFinish={onFinish} />}
        to={({ value }) => <SaveImportedVaultStep value={value} />}
      />
    )
  }

  const vault = pipe(
    vaultAsBase64String,
    fromBase64,
    (v) => new Uint8Array(v),
    (v) => fromBinary(VaultSchema, v),
    fromCommVault,
    (vault) => ({ ...vault, isBackedUp: true })
  )

  return <SaveImportedVaultStep value={vault} />
}
