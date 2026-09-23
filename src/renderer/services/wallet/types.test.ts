import { option as O } from 'fp-ts'

import { WalletType } from '../../../shared/wallet/types'
import {
  KeystoreState,
  StandaloneLedgerState,
  VultisigPhase,
  VultisigState,
  isVultisigMode,
  isKeystoreMode,
  isStandaloneLedgerMode,
  isVultisigVaultLocked,
  isVultisigVaultPasswordRequired,
  getWalletTypeFromState,
  isKeystoreReloadTrigger
} from './types'

describe('services/wallet/types', () => {
  // Mock states
  const keystoreNone: KeystoreState = O.none
  const keystoreLocked: KeystoreState = O.some({ id: 1, name: 'test-wallet' })
  const keystoreUnlocked: KeystoreState = O.some({ id: 1, name: 'test-wallet', phrase: 'test phrase' })

  const ledgerState: StandaloneLedgerState = {
    mode: 'standalone-ledger',
    detectionPhase: 'chain-selection',
    availableChains: []
  }

  const vultisigActive: VultisigState = {
    mode: 'standalone-vultisig',
    phase: VultisigPhase.Active,
    availableVaults: [],
    activeVault: { id: 'vault-1', name: 'My Vault', type: 'fast', isEncrypted: false, chains: ['Bitcoin'] },
    addresses: { Bitcoin: 'bc1qtest' }
  }

  const vultisigLocked: VultisigState = {
    mode: 'standalone-vultisig',
    phase: VultisigPhase.VaultLocked,
    availableVaults: [],
    activeVault: { id: 'vault-1', name: 'My Vault', type: 'secure', isEncrypted: true, chains: ['Bitcoin'] },
    addresses: {}
  }

  const vultisigSelection: VultisigState = {
    mode: 'standalone-vultisig',
    phase: VultisigPhase.VaultSelection,
    availableVaults: [],
    activeVault: null,
    addresses: {}
  }

  describe('isVultisigMode', () => {
    it('returns true for VultisigState', () => {
      expect(isVultisigMode(vultisigActive)).toBe(true)
    })
    it('returns true for locked VultisigState', () => {
      expect(isVultisigMode(vultisigLocked)).toBe(true)
    })
    it('returns false for KeystoreState (none)', () => {
      expect(isVultisigMode(keystoreNone)).toBe(false)
    })
    it('returns false for KeystoreState (locked)', () => {
      expect(isVultisigMode(keystoreLocked)).toBe(false)
    })
    it('returns false for StandaloneLedgerState', () => {
      expect(isVultisigMode(ledgerState)).toBe(false)
    })
  })

  describe('isKeystoreMode', () => {
    it('returns true for KeystoreState (none)', () => {
      expect(isKeystoreMode(keystoreNone)).toBe(true)
    })
    it('returns true for KeystoreState (locked)', () => {
      expect(isKeystoreMode(keystoreLocked)).toBe(true)
    })
    it('returns true for KeystoreState (unlocked)', () => {
      expect(isKeystoreMode(keystoreUnlocked)).toBe(true)
    })
    it('returns false for StandaloneLedgerState', () => {
      expect(isKeystoreMode(ledgerState)).toBe(false)
    })
    it('returns false for VultisigState', () => {
      expect(isKeystoreMode(vultisigActive)).toBe(false)
    })
  })

  describe('isStandaloneLedgerMode', () => {
    it('returns true for StandaloneLedgerState', () => {
      expect(isStandaloneLedgerMode(ledgerState)).toBe(true)
    })
    it('returns false for KeystoreState', () => {
      expect(isStandaloneLedgerMode(keystoreLocked)).toBe(false)
    })
    it('returns false for VultisigState', () => {
      expect(isStandaloneLedgerMode(vultisigActive)).toBe(false)
    })
  })

  describe('isVultisigVaultLocked', () => {
    it('returns true when phase is vault-locked', () => {
      expect(isVultisigVaultLocked(vultisigLocked)).toBe(true)
    })
    it('returns false when phase is active', () => {
      expect(isVultisigVaultLocked(vultisigActive)).toBe(false)
    })
    it('returns false when phase is vault-selection', () => {
      expect(isVultisigVaultLocked(vultisigSelection)).toBe(false)
    })
  })

  describe('isVultisigVaultPasswordRequired', () => {
    // Reports whether the vault is password-protected (encrypted), independent of
    // phase. The live "is the cache still warm?" decision lives in the modal.
    const encryptedActive: VultisigState = {
      ...vultisigActive,
      activeVault: { id: 'v', name: 'V', type: 'secure', isEncrypted: true, chains: [] }
    }

    it('is true for an encrypted vault (Active)', () => {
      expect(isVultisigVaultPasswordRequired(encryptedActive)).toBe(true)
    })
    it('is true for an encrypted vault (VaultLocked)', () => {
      // vultisigLocked is a secure, encrypted vault in the VaultLocked phase
      expect(isVultisigVaultPasswordRequired(vultisigLocked)).toBe(true)
    })
    it('is false for an un-encrypted vault', () => {
      // vultisigActive is a fast, un-encrypted vault
      expect(isVultisigVaultPasswordRequired(vultisigActive)).toBe(false)
    })
    it('falls back to true when there is no active vault', () => {
      expect(isVultisigVaultPasswordRequired(vultisigSelection)).toBe(true)
    })
    it('falls back to true for non-Vultisig states', () => {
      expect(isVultisigVaultPasswordRequired(keystoreUnlocked)).toBe(true)
      expect(isVultisigVaultPasswordRequired(ledgerState)).toBe(true)
    })
  })

  describe('getWalletTypeFromState', () => {
    it('returns Keystore for KeystoreState (none)', () => {
      expect(getWalletTypeFromState(keystoreNone)).toBe(WalletType.Keystore)
    })
    it('returns Keystore for KeystoreState (locked)', () => {
      expect(getWalletTypeFromState(keystoreLocked)).toBe(WalletType.Keystore)
    })
    it('returns Ledger for StandaloneLedgerState', () => {
      expect(getWalletTypeFromState(ledgerState)).toBe(WalletType.Ledger)
    })
    it('returns Vultisig for VultisigState', () => {
      expect(getWalletTypeFromState(vultisigActive)).toBe(WalletType.Vultisig)
    })
  })

  describe('isKeystoreReloadTrigger', () => {
    it('returns true for WalletType.Keystore', () => {
      expect(isKeystoreReloadTrigger(WalletType.Keystore)).toBe(true)
    })
    it('returns false for WalletType.Ledger', () => {
      expect(isKeystoreReloadTrigger(WalletType.Ledger)).toBe(false)
    })
    it('returns false for WalletType.Vultisig', () => {
      expect(isKeystoreReloadTrigger(WalletType.Vultisig)).toBe(false)
    })
  })
})
