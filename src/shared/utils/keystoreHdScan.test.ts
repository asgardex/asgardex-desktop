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
  HD_SCAN_MAX_COUNT,
  HD_SCAN_SLOT_COUNT,
  normalizeHdScanRange,
  settingsFromCustomPath
} from './keystoreHdScan'

describe('keystoreHdScan', () => {
  it('MetaMask varies index, keeps account 0 (default 0–4)', () => {
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

  it('Ledger Live also varies index on account 0 (not BIP account)', () => {
    const c = getEvmHdScanCandidates('ledgerlive')
    expect(c.every((x) => x.settings.account === 0)).toBe(true)
    expect(c.map((x) => x.settings.index)).toEqual([0, 1, 2, 3, 4])
    const path = getChainDerivationPath(
      ETHChain,
      c[1].settings.account,
      c[1].settings.index,
      undefined,
      c[1].settings.hdMode
    ).path
    expect(path).toBe("m/44'/60'/0'/0/1")
  })

  it('THOR varies address index on account 0', () => {
    const c = getThorHdScanCandidates()
    expect(c).toHaveLength(HD_SCAN_SLOT_COUNT)
    expect(c.every((x) => x.profile === 'thor' && x.settings.account === 0)).toBe(true)
    expect(c.map((x) => x.settings.index)).toEqual([0, 1, 2, 3, 4])
    const path = getChainDerivationPath(THORChain, c[1].settings.account, c[1].settings.index).path
    expect(path).toBe("m/44'/931'/0'/0/1")
  })

  it('BTC Native SegWit and Taproot vary address index on account 0', () => {
    const seg = getBtcHdScanCandidates('p2wpkh')
    const tr = getBtcHdScanCandidates('p2tr')
    expect(seg).toHaveLength(HD_SCAN_SLOT_COUNT)
    expect(seg.every((x) => x.settings.account === 0)).toBe(true)
    expect(seg.map((x) => x.settings.index)).toEqual([0, 1, 2, 3, 4])
    expect(tr.every((x) => x.settings.hdMode === 'p2tr' && x.settings.account === 0)).toBe(true)
    const segPath = getChainDerivationPath(BTCChain, 0, 1, undefined, 'p2wpkh').path
    const trPath = getChainDerivationPath(BTCChain, 0, 1, undefined, 'p2tr').path
    expect(segPath).toBe("m/84'/0'/0'/0/1")
    expect(trPath).toBe("m/86'/0'/0'/0/1")
  })

  it('respects a custom index range', () => {
    const c = getThorHdScanCandidates({ start: 5, end: 8 })
    expect(c.map((x) => x.settings.index)).toEqual([5, 6, 7, 8])
  })

  it('normalizeHdScanRange swaps, clamps, and caps span', () => {
    expect(normalizeHdScanRange(8, 5)).toEqual({ start: 5, end: 8 })
    expect(normalizeHdScanRange(-2, 3)).toEqual({ start: 0, end: 3 })
    const wide = normalizeHdScanRange(0, 1000)
    expect(wide.start).toBe(0)
    expect(wide.end - wide.start + 1).toBe(HD_SCAN_MAX_COUNT)
  })

  it('getHdScanCandidates dispatches by chain', () => {
    expect(getHdScanCandidates(ETHChain, 'metamask').length).toBe(5)
    expect(getHdScanCandidates(ETHChain, 'thor')).toHaveLength(0)
    expect(getHdScanCandidates(THORChain, 'thor').length).toBe(5)
    expect(getHdScanCandidates(THORChain, 'metamask')).toHaveLength(0)
    expect(getHdScanCandidates(BTCChain, 'p2wpkh').length).toBe(5)
    expect(getHdScanCandidates(BTCChain, 'p2tr').length).toBe(5)
    expect(getHdScanCandidates(BTCChain, 'p2wpkh', { start: 10, end: 12 }).length).toBe(3)
    expect(chainSupportsHdScan(ETHChain)).toBe(true)
    expect(chainSupportsHdScan(THORChain)).toBe(true)
    expect(chainSupportsHdScan(BTCChain)).toBe(true)
  })

  it('supports other EVM and UTXO standard chains', async () => {
    const { BSCChain } = await import('@xchainjs/xchain-bsc')
    const { LTCChain } = await import('@xchainjs/xchain-litecoin')
    const { AVAXChain } = await import('@xchainjs/xchain-avax')
    expect(chainSupportsHdScan(BSCChain)).toBe(true)
    expect(chainSupportsHdScan(AVAXChain)).toBe(true)
    expect(chainSupportsHdScan(LTCChain)).toBe(true)
    expect(getHdScanCandidates(BSCChain, 'metamask').length).toBe(5)
    expect(getHdScanCandidates(LTCChain, 'utxo').map((c) => c.settings.index)).toEqual([0, 1, 2, 3, 4])
    expect(getHdScanCandidates(LTCChain, 'metamask')).toHaveLength(0)
  })

  it('supports MAYAChain like THOR (coin-type 931)', async () => {
    const { MAYAChain } = await import('@xchainjs/xchain-mayachain')
    expect(chainSupportsHdScan(MAYAChain)).toBe(true)
    expect(getHdScanCandidates(MAYAChain, 'maya').map((c) => c.settings.index)).toEqual([0, 1, 2, 3, 4])
    expect(getHdScanCandidates(MAYAChain, 'thor')).toHaveLength(0)
  })

  it('custom path settings', () => {
    const s = settingsFromCustomPath("  m/44'/931'/2'/0/0  ")
    expect(s.customPath).toBe("m/44'/931'/2'/0/0")
    expect(candidateKey({ settings: s })).toBe("custom:m/44'/931'/2'/0/0")
  })
})
