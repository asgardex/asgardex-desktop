import type { SerializedVault } from '../../shared/api/mpcTypes'

export const DUPLICATE_VAULT_MESSAGE = 'This exact local vault share already exists'

export type VultisigVaultImportProbe = { status: 'imported'; vault: SerializedVault } | { status: 'duplicate' }

export const probeVultisigVaultImport = async (
  content: string,
  password?: string
): Promise<VultisigVaultImportProbe> => {
  const result = await window.apiMpc.importVault(content, password)
  if (!result.ok && result.code === 'DUPLICATE_VAULT') return { status: 'duplicate' }
  if (result.ok) return { status: 'imported', vault: result.vault }
  throw new Error('Unexpected vault import result')
}

export const replaceVultisigVaultImport = async (content: string, password?: string): Promise<SerializedVault> => {
  const result = await window.apiMpc.importVault(content, password, { conflictResolution: 'replace' })
  if (!result.ok) throw new Error(result.code)
  return result.vault
}
