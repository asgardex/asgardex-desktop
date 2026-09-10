import { beforeEach, describe, expect, it, vi } from 'vitest'

import { probeVultisigVaultImport, replaceVultisigVaultImport } from './importVultisigVault'

const vault = {
  id: 'vault-id',
  name: 'test',
  type: 'secure' as const,
  chains: [],
  threshold: 2,
  signerCount: 2,
  isEncrypted: false
}

describe('helpers/importVultisigVault', () => {
  const importVault = vi.fn()

  beforeEach(() => {
    importVault.mockReset()
    Object.defineProperty(window, 'apiMpc', {
      configurable: true,
      value: { importVault }
    })
  })

  it('probe returns duplicate when IPC returns DUPLICATE_VAULT', async () => {
    importVault.mockResolvedValue({ ok: false, code: 'DUPLICATE_VAULT' })
    await expect(probeVultisigVaultImport('content')).resolves.toEqual({ status: 'duplicate' })
    expect(importVault).toHaveBeenCalledWith('content', undefined)
  })

  it('probe returns imported vault when ok', async () => {
    importVault.mockResolvedValue({ ok: true, vault })
    await expect(probeVultisigVaultImport('content', 'pw')).resolves.toEqual({ status: 'imported', vault })
    expect(importVault).toHaveBeenCalledWith('content', 'pw')
  })

  it('probe returns existing-locked when IPC returns EXISTING_VAULT_PASSWORD_REQUIRED', async () => {
    importVault.mockResolvedValue({
      ok: false,
      code: 'EXISTING_VAULT_PASSWORD_REQUIRED',
      vaultId: 'existing-id'
    })
    await expect(probeVultisigVaultImport('content')).resolves.toEqual({
      status: 'existing-locked',
      vaultId: 'existing-id'
    })
    expect(importVault).toHaveBeenCalledWith('content', undefined)
  })

  it('replace calls importVault with conflictResolution replace', async () => {
    importVault.mockResolvedValue({ ok: true, vault })
    await expect(replaceVultisigVaultImport('content', 'pw')).resolves.toEqual(vault)
    expect(importVault).toHaveBeenCalledWith('content', 'pw', { conflictResolution: 'replace' })
  })
})
