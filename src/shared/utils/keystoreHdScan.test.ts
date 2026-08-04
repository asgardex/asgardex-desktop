import { ETHChain } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { describe, expect, it } from 'vitest'

import { getChainDerivationPath } from './derivationPath'
import {
  candidateKey,
  chainSupportsEvmHdScan,
  EVM_HD_SCAN_SLOT_COUNT,
  getEvmHdScanCandidates,
  getHdScanCandidates,
  settingsFromCustomPath
} from './keystoreHdScan'

describe('keystoreHdScan', () => {
  it('MetaMask varies index, keeps account 0', () => {
    const c = getEvmHdScanCandidates('metamask')
    expect(c).toHaveLength(EVM_HD_SCAN_SLOT_COUNT)
    expect(c.every((x) => x.settings.account === 0)).toBe(true)
    expect(c.map((x) => x.settings.index)).toEqual([0, 1, 2, 3, 4])
    // Account 2 in MetaMask UI → index 1 → …/0/1
    const path = getChainDerivationPath(
      ETHChain,
      c[1].settings.account,
      c[1].settings.index,
      undefined,
      c[1].settings.hdMode
    ).path
    expect(path.endsWith('/1')).toBe(true)
    expect(path).toContain("m/44'/60'/0'/0/")
  })

  it('Ledger Live varies account, keeps index 0', () => {
    const c = getEvmHdScanCandidates('ledgerlive')
    expect(c.every((x) => x.settings.index === 0)).toBe(true)
    expect(c.map((x) => x.settings.account)).toEqual([0, 1, 2, 3, 4])
    const path = getChainDerivationPath(
      ETHChain,
      c[1].settings.account,
      c[1].settings.index,
      undefined,
      c[1].settings.hdMode
    ).path
    expect(path).toBe("m/44'/60'/1'/0/0")
  })

  it('legacy varies index', () => {
    const c = getEvmHdScanCandidates('legacy', 2)
    expect(c.map((x) => x.settings.index)).toEqual([0, 1])
    expect(c.every((x) => x.settings.hdMode === 'legacy')).toBe(true)
  })

  it('1-based account labels', () => {
    expect(getEvmHdScanCandidates('metamask', 2).map((x) => x.accountLabel)).toEqual([1, 2])
  })

  it('ETH only for now', () => {
    expect(chainSupportsEvmHdScan(ETHChain)).toBe(true)
    expect(getHdScanCandidates(ETHChain, 'metamask').length).toBe(5)
    expect(getHdScanCandidates(THORChain, 'metamask')).toHaveLength(0)
  })

  it('custom path settings', () => {
    const s = settingsFromCustomPath("  m/44'/60'/2'/0/0  ")
    expect(s.customPath).toBe("m/44'/60'/2'/0/0")
    expect(candidateKey({ settings: s })).toBe("custom:m/44'/60'/2'/0/0")
  })
})
