import { create, toBinary } from '@bufbuild/protobuf'
import { useMutation } from '@tanstack/react-query'
import { useVultisig } from '../../../../../store/vultisig/hooks'
import { initiateFileDownload as saveFile } from '../../../../lib/ui/utils/initiateFileDownload'
import { encryptWithAesGcm } from '../../../../lib/utils/encryption/aesGcm/encryptWithAesGcm'
import { toCommVault } from '../../../mpc/types/utils/commVault'
import { VaultContainerSchema } from '../../../mpc/types/vultisig/vault/v1/vault_container_pb'
import { VaultSchema } from '../../../mpc/types/vultisig/vault/v1/vault_pb'

import { Vault } from '../Vault'

const getExportName = (vault: Vault) => {
  const totalSigners = vault.signers.length
  const localPartyIndex = vault.signers.indexOf(vault.localPartyId) + 1

  return `${vault.name}-${vault.localPartyId}-share${localPartyIndex}of${totalSigners}.vult`
}

const createBackup = async (vault: Vault, password?: string) => {
  const commVault = toCommVault(vault)
  const vaultData = toBinary(VaultSchema, commVault)

  const vaultContainer = create(VaultContainerSchema, {
    version: BigInt(1),
    vault: Buffer.from(vaultData).toString('base64')
  })

  if (password) {
    vaultContainer.isEncrypted = true
    const encryptedVault = encryptWithAesGcm({
      key: password,
      value: Buffer.from(vaultData)
    })
    vaultContainer.vault = encryptedVault.toString('base64')
  } else {
    vaultContainer.isEncrypted = false
  }

  const vaultContainerData = toBinary(VaultContainerSchema, vaultContainer)

  return Buffer.from(vaultContainerData).toString('base64')
}

export const useBackupVaultMutation = ({
  onSuccess
}: {
  onSuccess?: () => void
} = {}) => {
  const { vault, setVault } = useVultisig()

  return useMutation({
    mutationFn: async ({ password }: { password?: string }) => {
      if (!vault) throw new Error('Vault is not available')
      const base64Data = await createBackup(vault, password)

      const blob = new Blob([base64Data], { type: 'application/octet-stream' })

      saveFile({
        name: getExportName(vault),
        blob
      })

      console.log('BACKUP FLOW - ', vault.name)

      setVault({
        ...vault,
        isBackedUp: true
      })
    },
    onSuccess
  })
}
