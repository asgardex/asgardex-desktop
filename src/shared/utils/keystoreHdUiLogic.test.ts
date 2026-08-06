import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { describe, expect, it } from 'vitest'

import { HD_SCAN_MAX_COUNT, HD_SCAN_MAX_INDEX } from './keystoreHdScan'
import {
  accountIndexSaveEnabled,
  defaultCustomPathForChain,
  defaultProfileForChain,
  initialCustomPathFromSettings,
  parseScanDraftIndex,
  parseSlotDraft,
  pickDefaultScanSelection,
  profilesForChain,
  quietRowPreviewPath,
  scanRangeFromDrafts,
  slotsAreDirty
} from './keystoreHdUiLogic'

describe('keystoreHdUiLogic — profiles', () => {
  it('EVM chains share MetaMask + Legacy only (no separate Ledger Live card)', () => {
    for (const chain of [ETHChain, BSCChain]) {
      const ids = profilesForChain(chain).map((p) => p.id)
      expect(ids).toEqual(['metamask', 'legacy'])
      expect(defaultProfileForChain(chain)).toBe('metamask')
    }
  })

  it('THOR / MAYA / BTC / UTXO defaults', () => {
    expect(profilesForChain(THORChain).map((p) => p.id)).toEqual(['thor'])
    expect(defaultProfileForChain(THORChain)).toBe('thor')
    expect(profilesForChain(MAYAChain).map((p) => p.id)).toEqual(['maya'])
    expect(defaultProfileForChain(MAYAChain)).toBe('maya')
    expect(profilesForChain(BTCChain).map((p) => p.id)).toEqual(['p2wpkh', 'p2tr'])
    expect(defaultProfileForChain(BTCChain)).toBe('p2wpkh')
    expect(profilesForChain(LTCChain).map((p) => p.id)).toEqual(['utxo'])
    expect(profilesForChain(BCHChain).map((p) => p.id)).toEqual(['utxo'])
    expect(defaultProfileForChain(LTCChain)).toBe('utxo')
  })
})

describe('keystoreHdUiLogic — scan range drafts', () => {
  it('defaults empty drafts via fallbacks to 0–4', () => {
    expect(scanRangeFromDrafts('', '')).toEqual({ start: 0, end: 4 })
  })

  it('swaps inverted range', () => {
    expect(scanRangeFromDrafts('10', '3')).toEqual({ start: 3, end: 10 })
  })

  it('caps span at HD_SCAN_MAX_COUNT', () => {
    const r = scanRangeFromDrafts('0', '1000')
    expect(r.start).toBe(0)
    expect(r.end - r.start + 1).toBe(HD_SCAN_MAX_COUNT)
  })

  it('clamps index to HD_SCAN_MAX_INDEX', () => {
    expect(parseScanDraftIndex(String(HD_SCAN_MAX_INDEX + 50), 0)).toBe(HD_SCAN_MAX_INDEX)
    expect(parseScanDraftIndex('-1', 7)).toBe(7)
    expect(parseScanDraftIndex('abc', 2)).toBe(2)
  })
})

describe('keystoreHdUiLogic — scan result selection', () => {
  const hits = [
    { key: 'a', address: 'addrA', hasFunds: false },
    { key: 'b', address: 'addrB', hasFunds: true },
    { key: 'c', address: '', hasFunds: true },
    { key: 'd', address: 'addrD', hasFunds: false }
  ]

  it('prefers current locked key when present with address', () => {
    expect(pickDefaultScanSelection(hits, 'd')).toBe('d')
  })

  it('prefers first funded with address when current missing', () => {
    expect(pickDefaultScanSelection(hits, 'missing')).toBe('b')
    expect(pickDefaultScanSelection(hits, null)).toBe('b')
  })

  it('falls back to first address when none funded', () => {
    const emptyFunded = [
      { key: 'x', address: '1', hasFunds: false },
      { key: 'y', address: '2', hasFunds: false }
    ]
    expect(pickDefaultScanSelection(emptyFunded, null)).toBe('x')
  })

  it('returns null when no addresses', () => {
    expect(pickDefaultScanSelection([{ key: 'z', address: '', hasFunds: true }], null)).toBeNull()
  })
})

describe('keystoreHdUiLogic — quiet row account/index', () => {
  it('parseSlotDraft digits only semantics', () => {
    expect(parseSlotDraft('3', 0)).toBe(3)
    expect(parseSlotDraft('', 9)).toBe(9)
    expect(parseSlotDraft('nope', 1)).toBe(1)
  })

  it('save enabled only when dirty and not saving', () => {
    expect(slotsAreDirty(0, 1, { account: 0, index: 0 })).toBe(true)
    expect(slotsAreDirty(0, 0, { account: 0, index: 0 })).toBe(false)
    expect(accountIndexSaveEnabled(true, false)).toBe(true)
    expect(accountIndexSaveEnabled(true, true)).toBe(false)
    expect(accountIndexSaveEnabled(false, false)).toBe(false)
  })

  it('preview shows custom path until slots change', () => {
    const settings = {
      hdMode: 'default' as const,
      account: 0,
      index: 0,
      customPath: "m/44'/931'/2'/0/0"
    }
    expect(quietRowPreviewPath(THORChain, Network.Mainnet, settings, 0, 0)).toBe("m/44'/931'/2'/0/0")
    // dirty → formula for draft slots
    expect(quietRowPreviewPath(THORChain, Network.Mainnet, settings, 0, 1)).toBe("m/44'/931'/0'/0/1")
  })

  it('default / initial custom paths', () => {
    expect(defaultCustomPathForChain(ETHChain, Network.Mainnet)).toContain("m/44'/60'")
    expect(defaultCustomPathForChain(BTCChain, Network.Mainnet)).toContain("m/84'")
    expect(
      initialCustomPathFromSettings(ETHChain, Network.Mainnet, {
        customPath: "  m/44'/60'/0'/0/5  ",
        account: 0,
        index: 0,
        hdMode: 'metamask'
      })
    ).toBe("m/44'/60'/0'/0/5")
    expect(
      initialCustomPathFromSettings(ETHChain, Network.Mainnet, {
        account: 0,
        index: 3,
        hdMode: 'metamask'
      })
    ).toBe("m/44'/60'/0'/0/3")
  })
})
