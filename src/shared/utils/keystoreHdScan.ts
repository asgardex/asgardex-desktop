import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

import { EvmHDMode } from '../evm/types'
import { UtxoHDMode } from '../utxo/types'
import { KeystoreChainHDSettings } from '../wallet/types'

/** Default scan window when the user does not pick a range (indexes 0–4). */
export const HD_SCAN_DEFAULT_START = 0
export const HD_SCAN_DEFAULT_END = 4
/** Highest address index the UI will accept. */
export const HD_SCAN_MAX_INDEX = 100
/** Cap how many indexes one scan may touch (RPC / UX). */
export const HD_SCAN_MAX_COUNT = 25

/** @deprecated use HD_SCAN_DEFAULT_END + 1 */
export const HD_SCAN_SLOT_COUNT = HD_SCAN_DEFAULT_END - HD_SCAN_DEFAULT_START + 1

export type HdScanIndexRange = {
  /** Inclusive start address index */
  start: number
  /** Inclusive end address index */
  end: number
}

export const DEFAULT_HD_SCAN_RANGE: HdScanIndexRange = {
  start: HD_SCAN_DEFAULT_START,
  end: HD_SCAN_DEFAULT_END
}

/**
 * Clamp and order a user-chosen index range. Swaps if start > end; caps span
 * at HD_SCAN_MAX_COUNT and indexes at HD_SCAN_MAX_INDEX.
 */
export const normalizeHdScanRange = (start: number, end: number): HdScanIndexRange => {
  const clamp = (n: number) => {
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.min(Math.floor(n), HD_SCAN_MAX_INDEX))
  }
  let s = clamp(start)
  let e = clamp(end)
  if (e < s) {
    const t = s
    s = e
    e = t
  }
  if (e - s + 1 > HD_SCAN_MAX_COUNT) {
    e = s + HD_SCAN_MAX_COUNT - 1
  }
  return { start: s, end: e }
}

/**
 * Wallet / path profile chosen before scanning.
 * All profiles vary address index only (account stays 0). Multi-account BIP paths → custom path.
 */
export type HdScanProfile = 'metamask' | 'ledgerlive' | 'legacy' | 'thor' | 'p2wpkh' | 'p2tr' | 'custom'

export type HdScanCandidate = {
  settings: KeystoreChainHDSettings
  /** 1-based sort key (index + 1); UI shows zero-based `settings.index` */
  accountLabel: number
  profile: Exclude<HdScanProfile, 'custom'>
}

const candidatesForRange = (
  profile: Exclude<HdScanProfile, 'custom'>,
  range: HdScanIndexRange,
  settingsForIndex: (index: number) => KeystoreChainHDSettings
): HdScanCandidate[] => {
  const { start, end } = normalizeHdScanRange(range.start, range.end)
  const out: HdScanCandidate[] = []
  for (let index = start; index <= end; index++) {
    out.push({
      profile,
      accountLabel: index + 1,
      settings: settingsForIndex(index)
    })
  }
  return out
}

/**
 * EVM candidates — **address index only**, account always 0.
 *
 * - MetaMask:     m/44'/60'/0'/0/{index}
 * - Ledger Live:  m/44'/60'/0'/0/{index}  (account 0; multi-account → custom path)
 * - Legacy:       m/44'/60'/0'/{index}
 */
export const getEvmHdScanCandidates = (
  profile: 'metamask' | 'ledgerlive' | 'legacy',
  range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE
): HdScanCandidate[] => {
  const hdMode: EvmHDMode = profile === 'ledgerlive' ? 'ledgerlive' : profile === 'metamask' ? 'metamask' : 'legacy'
  return candidatesForRange(profile, range, (index) => ({ hdMode, account: 0, index }))
}

/**
 * THORChain BIP44: m/44'/931'/0'/0/{index} — vary address index only.
 * Account stays 0 (most wallets); index is what users mean by “next address”.
 */
export const getThorHdScanCandidates = (range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE): HdScanCandidate[] =>
  candidatesForRange('thor', range, (index) => ({ hdMode: 'default', account: 0, index }))

/**
 * Bitcoin: Native SegWit BIP84 or Taproot BIP86 — vary address index, account 0.
 * Paths: m/84'/0'/0'/0/{index} or m/86'/0'/0'/0/{index}
 */
export const getBtcHdScanCandidates = (
  profile: 'p2wpkh' | 'p2tr',
  range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE
): HdScanCandidate[] => {
  const hdMode: UtxoHDMode = profile
  return candidatesForRange(profile, range, (index) => ({ hdMode, account: 0, index }))
}

export const chainSupportsHdScan = (chain: Chain): boolean =>
  chain === ETHChain || chain === THORChain || chain === BTCChain

export const getHdScanCandidates = (
  chain: Chain,
  profile: Exclude<HdScanProfile, 'custom'>,
  range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE
): HdScanCandidate[] => {
  if (chain === ETHChain) {
    if (profile === 'metamask' || profile === 'ledgerlive' || profile === 'legacy') {
      return getEvmHdScanCandidates(profile, range)
    }
    return []
  }
  if (chain === THORChain) {
    if (profile !== 'thor') return []
    return getThorHdScanCandidates(range)
  }
  if (chain === BTCChain) {
    if (profile === 'p2wpkh' || profile === 'p2tr') return getBtcHdScanCandidates(profile, range)
    return []
  }
  return []
}

export const candidateKey = (c: { settings: KeystoreChainHDSettings }): string => {
  const { hdMode, account, index, customPath } = c.settings
  return customPath?.trim() ? `custom:${customPath.trim()}` : `${hdMode}:${account}:${index}`
}

/** Settings blob for a user-entered full BIP path. */
export const settingsFromCustomPath = (fullPath: string): KeystoreChainHDSettings => ({
  hdMode: 'default',
  account: 0,
  index: 0,
  customPath: fullPath.trim()
})

/** @deprecated use HD_SCAN_SLOT_COUNT */
export const EVM_HD_SCAN_SLOT_COUNT = HD_SCAN_SLOT_COUNT
/** @deprecated use chainSupportsHdScan */
export const chainSupportsEvmHdScan = chainSupportsHdScan
