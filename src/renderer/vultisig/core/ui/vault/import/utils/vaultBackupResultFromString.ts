import { VaultBackupExtension } from '../VaultBackupExtension'
import { VaultBackupResult } from '../VaultBackupResult'
import { fromDatBackupString } from './fromDatBackupString'
import { vaultContainerFromString } from './vaultContainerFromString'

type Input = {
  extension: VaultBackupExtension
  value: ArrayBuffer
}

export const vaultBackupResultFromFileContent = ({ value, extension }: Input): VaultBackupResult => {
  const valueAsString = new TextDecoder().decode(value)

  if (extension === 'dat') {
    try {
      const vault = fromDatBackupString(valueAsString)

      return { vault }
    } catch {
      return { encryptedVault: value }
    }
  }

  return { vaultContainer: vaultContainerFromString(valueAsString) }
}
