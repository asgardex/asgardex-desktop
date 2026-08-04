import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { describe, expect, it } from 'vitest'

import { getChainDerivationPath } from './derivationPath'
import {
  candidateKey,
  chainSupportsHdScan,
  getBtcHdScanCandidates,
  getEvmHdScanCandidates,
  getHdScanCandidates,
  getThorHdScanCandidates,
  HD_SCAN_SLOT_COUNT,
  settingsFromCustomPath
} from './keystoreHdScan'

describe('keystoreHdScan', () => {
  it('MetaMask varies index, keeps account 0', () => {
    const c = getEvmHdScanCandidates('metamask')
    expect(c).toHaveLength(HD_SCAN_SLOT_COUNT)
    expect(c.every((x) => x.settings.account === 0)).toBe(true)
    expect(c.map((x) => x.settings.index)).toEqual([0, 1, 2, 3, 4])
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

  it('THOR varies BIP44 account on 931 coin type', () => {
    const c = getThorHdScanCandidates()
    expect(c).toHaveLength(HD_SCAN_SLOT_COUNT)
    expect(c.every((x) => x.profile === 'thor' && x.settings.index === 0)).toBe(true)
    expect(c.map((x) => x.settings.account)).toEqual([0, 1, 2, 3, 4])
    const path = getChainDerivationPath(THORChain, c[1].settings.account, c[1].settings.index).path
    expect(path).toBe("m/44'/931'/1'/0/0")
  })

  it('BTC Native SegWit and Taproot vary account', () => {
    const seg = getBtcHdScanCandidates('p2wpkh')
    const tr = getBtcHdScanCandidates('p2tr')
    expect(seg).toHaveLength(HD_SCAN_SLOT_COUNT)
    expect(tr.every((x) => x.settings.hdMode === 'p2tr' && x.settings.index === 0)).toBe(true)
    const segPath = getChainDerivationPath(BTCChain, 1, 0, undefined, 'p2wpkh').path
    const trPath = getChainDerivationPath(BTCChain, 1, 0, undefined, 'p2tr').path
    expect(segPath).toContain("84'")
    expect(segPath).toContain("/1'/")
    expect(trPath).toContain("86'")
  })

  it('getHdScanCandidates dispatches by chain', () => {
    expect(getHdScanCandidates(ETHChain, 'metamask').length).toBe(5)
    expect(getHdScanCandidates(ETHChain, 'thor')).toHaveLength(0)
    expect(getHdScanCandidates(THORChain, 'thor').length).toBe(5)
    expect(getHdScanCandidates(THORChain, 'metamask')).toHaveLength(0)
    expect(getHdScanCandidates(BTCChain, 'p2wpkh').length).toBe(5)
    expect(getHdScanCandidates(BTCChain, 'p2tr').length).toBe(5)
    expect(chainSupportsHdScan(ETHChain)).toBe(true)
    expect(chainSupportsHdScan(THORChain)).toBe(true)
    expect(chainSupportsHdScan(BTCChain)).toBe(true)
  })

  it('custom path settings', () => {
    const s = settingsFromCustomPath("  m/44'/931'/2'/0/0  ")
    expect(s.customPath).toBe("m/44'/931'/2'/0/0")
    expect(candidateKey({ settings: s })).toBe("custom:m/44'/931'/2'/0/0")
  })
})
