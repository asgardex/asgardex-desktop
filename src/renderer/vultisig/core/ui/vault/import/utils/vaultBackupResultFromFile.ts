import { readFileAsArrayBuffer } from '../../../../../lib/utils/file/readFileAsArrayBuffer'
import { getVaultBackupExtension } from '../VaultBackupExtension'
import { FileBasedVaultBackupResult } from '../VaultBackupResult'
import { isLikelyToBeDklsVaultBackup } from './isLikelyToBeDklsVaultBackup'
import { vaultBackupResultFromFileContent } from './vaultBackupResultFromString'

export const vaultBackupResultFromFile = async (file: File): Promise<FileBasedVaultBackupResult> => {
  const fileContent = await readFileAsArrayBuffer(file)

  const result = vaultBackupResultFromFileContent({
    value: fileContent,
    extension: getVaultBackupExtension(file.name)
  })

  if (
    isLikelyToBeDklsVaultBackup({
      size: file.size,
      fileName: file.name
    })
  ) {
    return {
      result,
      override: { libType: 'DKLS' }
    }
  }

  return {
    result
  }
}
