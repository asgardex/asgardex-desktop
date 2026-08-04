import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

import { EvmHDMode } from '../evm/types'
import { UtxoHDMode } from '../utxo/types'
import { KeystoreChainHDSettings } from '../wallet/types'

/** Max address indexes scanned for one profile (indexes 0–4). */
export const HD_SCAN_SLOT_COUNT = 5

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

/**
 * EVM candidates for a single profile (≤5) — **address index only**, account always 0.
 *
 * - MetaMask:     m/44'/60'/0'/0/{index}
 * - Ledger Live:  m/44'/60'/0'/0/{index}  (account 0; multi-account → custom path)
 * - Legacy:       m/44'/60'/0'/{index}
 */
export const getEvmHdScanCandidates = (
  profile: 'metamask' | 'ledgerlive' | 'legacy',
  slotCount: number = HD_SCAN_SLOT_COUNT
): HdScanCandidate[] => {
  const n = Math.max(1, Math.min(slotCount, 20))
  const out: HdScanCandidate[] = []
  const hdMode: EvmHDMode = profile === 'ledgerlive' ? 'ledgerlive' : profile === 'metamask' ? 'metamask' : 'legacy'

  for (let index = 0; index < n; index++) {
    out.push({
      profile,
      accountLabel: index + 1,
      settings: { hdMode, account: 0, index }
    })
  }
  return out
}

/**
 * THORChain BIP44: m/44'/931'/0'/0/{index} — vary address index only (≤5).
 * Account stays 0 (most wallets); index is what users mean by “next address”.
 */
export const getThorHdScanCandidates = (slotCount: number = HD_SCAN_SLOT_COUNT): HdScanCandidate[] => {
  const n = Math.max(1, Math.min(slotCount, 20))
  const out: HdScanCandidate[] = []
  for (let index = 0; index < n; index++) {
    out.push({
      profile: 'thor',
      accountLabel: index + 1,
      settings: { hdMode: 'default', account: 0, index }
    })
  }
  return out
}

/**
 * Bitcoin: Native SegWit BIP84 or Taproot BIP86 — vary address index, account 0 (≤5).
 * Paths: m/84'/0'/0'/0/{index} or m/86'/0'/0'/0/{index}
 */
export const getBtcHdScanCandidates = (
  profile: 'p2wpkh' | 'p2tr',
  slotCount: number = HD_SCAN_SLOT_COUNT
): HdScanCandidate[] => {
  const n = Math.max(1, Math.min(slotCount, 20))
  const hdMode: UtxoHDMode = profile
  const out: HdScanCandidate[] = []
  for (let index = 0; index < n; index++) {
    out.push({
      profile,
      accountLabel: index + 1,
      settings: { hdMode, account: 0, index }
    })
  }
  return out
}

export const chainSupportsHdScan = (chain: Chain): boolean =>
  chain === ETHChain || chain === THORChain || chain === BTCChain

export const getHdScanCandidates = (
  chain: Chain,
  profile: Exclude<HdScanProfile, 'custom'>,
  slotCount?: number
): HdScanCandidate[] => {
  if (chain === ETHChain) {
    if (profile === 'metamask' || profile === 'ledgerlive' || profile === 'legacy') {
      return getEvmHdScanCandidates(profile, slotCount)
    }
    return []
  }
  if (chain === THORChain) {
    if (profile !== 'thor') return []
    return getThorHdScanCandidates(slotCount)
  }
  if (chain === BTCChain) {
    if (profile === 'p2wpkh' || profile === 'p2tr') return getBtcHdScanCandidates(profile, slotCount)
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
