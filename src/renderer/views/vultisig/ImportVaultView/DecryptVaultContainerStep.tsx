import { fromBinary } from '@bufbuild/protobuf'
import { useMutation } from '@tanstack/react-query'
import { fromCommVault } from '../../../vultisig/core/mpc/types/utils/commVault'
import { VaultSchema } from '../../../vultisig/core/mpc/types/vultisig/vault/v1/vault_pb'
import { Vault } from '../../../vultisig/core/ui/vault/Vault'
import { OnFinishProp, ValueProp } from '../../../vultisig/lib/ui/props'
import { decryptWithAesGcm } from '../../../vultisig/lib/utils/encryption/aesGcm/decryptWithAesGcm'
import { fromBase64 } from '../../../vultisig/lib/utils/fromBase64'
import { pipe } from '../../../vultisig/lib/utils/pipe'
import { DecryptVaultView } from './DecryptVaultView'

export const DecryptVaultContainerStep = ({ value, onFinish }: ValueProp<string> & OnFinishProp<Vault>) => {
  const { mutate, error, isPending } = useMutation({
    mutationFn: async (password: string) =>
      pipe(
        value,
        fromBase64,
        (vault) =>
          decryptWithAesGcm({
            key: password,
            value: vault
          }),
        (v) => new Uint8Array(v),
        (binary) => fromBinary(VaultSchema, binary),
        fromCommVault,
        (vault) => ({ ...vault, isBackedUp: true })
      ),
    onSuccess: onFinish
  })

  return <DecryptVaultView isPending={isPending} error={error} onSubmit={mutate} />
}
