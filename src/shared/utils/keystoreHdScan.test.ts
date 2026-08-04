import { ETHChain } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { describe, expect, it } from 'vitest'

import {
  candidateKey,
  chainSupportsEvmHdScan,
  EVM_HD_SCAN_ACCOUNT_COUNT,
  getEvmHdScanCandidates,
  getHdScanCandidates
} from './keystoreHdScan'

describe('keystoreHdScan', () => {
  it('builds 3 modes × N accounts for EVM (index 0)', () => {
    const c = getEvmHdScanCandidates()
    expect(c).toHaveLength(3 * EVM_HD_SCAN_ACCOUNT_COUNT)
    expect(c.every((x) => x.settings.index === 0)).toBe(true)
    expect(c.filter((x) => x.modeLabel === 'standard')).toHaveLength(EVM_HD_SCAN_ACCOUNT_COUNT)
    expect(c.filter((x) => x.modeLabel === 'metamask')).toHaveLength(EVM_HD_SCAN_ACCOUNT_COUNT)
    expect(c.filter((x) => x.modeLabel === 'legacy')).toHaveLength(EVM_HD_SCAN_ACCOUNT_COUNT)
  })

  it('uses 1-based account labels', () => {
    const first = getEvmHdScanCandidates(2).find((x) => x.modeLabel === 'standard' && x.settings.account === 0)
    const second = getEvmHdScanCandidates(2).find((x) => x.modeLabel === 'standard' && x.settings.account === 1)
    expect(first?.accountLabel).toBe(1)
    expect(second?.accountLabel).toBe(2)
  })

  it('supports ETH scan and not THOR (yet)', () => {
    expect(chainSupportsEvmHdScan(ETHChain)).toBe(true)
    expect(getHdScanCandidates(ETHChain).length).toBeGreaterThan(0)
    expect(getHdScanCandidates(THORChain)).toHaveLength(0)
  })

  it('candidateKey is stable and unique per settings', () => {
    const [a, b] = getEvmHdScanCandidates(1)
    expect(candidateKey(a)).not.toEqual(candidateKey(b))
    expect(candidateKey(a)).toEqual(candidateKey({ settings: { ...a.settings } }))
  })
})
