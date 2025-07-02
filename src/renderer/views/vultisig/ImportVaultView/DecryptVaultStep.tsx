import { useMutation } from '@tanstack/react-query'

import { decryptDatBackup } from '../../../vultisig/core/ui/vault/import/utils/decryptDatBackup'
import { fromDatBackupString } from '../../../vultisig/core/ui/vault/import/utils/fromDatBackupString'
import { Vault } from '../../../vultisig/core/ui/vault/Vault'
import { OnFinishProp, ValueProp } from '../../../vultisig/lib/ui/props'
import { DecryptVaultView } from './DecryptVaultView'

export const DecryptVaultStep = ({ value, onFinish }: ValueProp<ArrayBuffer> & OnFinishProp<Vault>) => {
  const { mutate, error, isPending } = useMutation({
    mutationFn: async (password: string) => {
      const decrypted = await decryptDatBackup({
        backup: value,
        password
      })

      const valueAsString = new TextDecoder().decode(decrypted)

      return fromDatBackupString(valueAsString)
    },
    onSuccess: onFinish
  })

  return <DecryptVaultView isPending={isPending} error={error} onSubmit={mutate} />
}
