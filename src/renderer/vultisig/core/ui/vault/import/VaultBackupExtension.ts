import { getLastItem } from '../../../../lib/utils/array/getLastItem'
import { isOneOf } from '../../../../lib/utils/array/isOneOf'

export const vaultBackupExtensions = ['bak', 'vult']

export type VaultBackupExtension = typeof vaultBackupExtensions[number]

export const getVaultBackupExtension = (fileName: string) => {
  const extension = getLastItem(fileName.split('.'))

  if (!isOneOf(extension, vaultBackupExtensions)) {
    throw new Error(`Invalid vault backup extension: ${extension}`)
  }

  return extension
}
