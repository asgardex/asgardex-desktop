type IsLikelyToBeDklsVaultBackupInput = {
  size: number
  fileName: string
}

export const isLikelyToBeDklsVaultBackup = ({ size, fileName }: IsLikelyToBeDklsVaultBackupInput): boolean => {
  const isLargeFile = size > 150 * 1024
  const isShareFile = /share\d+of\d+/.test(fileName)

  return isLargeFile || isShareFile
}
