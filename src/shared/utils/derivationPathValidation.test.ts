import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'

import { validateDerivationPath, warnDerivationPath } from './derivationPathValidation'

describe('shared/utils/derivationPathValidation', () => {
  describe('validateDerivationPath', () => {
    it('accepts standard hardened + non-hardened paths', () => {
      expect(validateDerivationPath("m/44'/60'/0'/0/0").valid).toBe(true)
      expect(validateDerivationPath("m/84'/0'/0'/0/12").valid).toBe(true)
      expect(validateDerivationPath("m/86'/0'/1'/0/0").valid).toBe(true)
    })
    it('trims surrounding whitespace', () => {
      expect(validateDerivationPath("  m/44'/931'/0'/0/0  ").valid).toBe(true)
    })
    it('rejects empty', () => {
      expect(validateDerivationPath('')).toEqual({ valid: false, error: 'empty' })
      expect(validateDerivationPath('   ')).toEqual({ valid: false, error: 'empty' })
    })
    it('rejects malformed paths', () => {
      expect(validateDerivationPath("44'/60'/0'/0/0").error).toBe('format') // no leading m
      expect(validateDerivationPath('m/').error).toBe('format')
      expect(validateDerivationPath("m/44'/60'/x/0/0").error).toBe('format') // non-numeric
      expect(validateDerivationPath("m/44'/60'/0'/0/0/").error).toBe('format') // trailing slash
    })
    it('rejects out-of-range segments', () => {
      expect(validateDerivationPath(`m/44'/60'/${2 ** 31}'/0/0`).error).toBe('range')
    })
    it('rejects hardened final address index (clients need a plain walletIndex)', () => {
      expect(validateDerivationPath("m/44'/60'/0'/0/9'").valid).toBe(false)
      expect(validateDerivationPath("m/44'/60'/0'/0/9'").error).toBe('format')
      expect(validateDerivationPath("m/44'/60'/0'/0/9").valid).toBe(true)
    })
  })

  describe('warnDerivationPath', () => {
    it('no warning for a standard chain path on mainnet', () => {
      expect(warnDerivationPath("m/44'/60'/0'/0/0", ETHChain, Network.Mainnet)).toBeUndefined()
      expect(warnDerivationPath("m/44'/931'/0'/0/0", THORChain, Network.Mainnet)).toBeUndefined()
    })
    it('warns on testnet coin-type used on mainnet', () => {
      expect(warnDerivationPath("m/44'/1'/0'/0/0", ETHChain, Network.Mainnet)).toMatch(/testnet coin-type/i)
    })
    it('warns on mainnet coin-type used on testnet', () => {
      expect(warnDerivationPath("m/44'/60'/0'/0/0", ETHChain, Network.Testnet)).toMatch(/testnet normally uses/i)
    })
    it("warns when coin-type doesn't match the chain's standard", () => {
      // BTC standard is coin-type 0'; feeding 60' should flag a mismatch
      expect(warnDerivationPath("m/44'/60'/0'/0/0", BTCChain, Network.Mainnet)).toMatch(/does not match/i)
    })
    it('returns undefined for an invalid path (validation handles blocking)', () => {
      expect(warnDerivationPath('not-a-path', ETHChain, Network.Mainnet)).toBeUndefined()
    })
  })
})
