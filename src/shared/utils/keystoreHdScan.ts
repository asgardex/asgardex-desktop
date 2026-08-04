import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

import { EvmHDMode } from '../evm/types'
import { UtxoHDMode } from '../utxo/types'
import { KeystoreChainHDSettings } from '../wallet/types'

/** Max accounts/indices scanned for one profile (Accounts 1–5 in the UI). */
export const HD_SCAN_SLOT_COUNT = 5

/**
 * Wallet / path profile chosen before scanning.
 * EVM wallets use different formulas; THOR BIP44 account; BTC Native SegWit vs Taproot.
 */
export type HdScanProfile = 'metamask' | 'ledgerlive' | 'legacy' | 'thor' | 'p2wpkh' | 'p2tr' | 'custom'

export type HdScanCandidate = {
  settings: KeystoreChainHDSettings
  /** 1-based “Account N” label in the UI */
  accountLabel: number
  profile: Exclude<HdScanProfile, 'custom'>
}

/**
 * EVM candidates for a single profile (≤5).
 *
 * - MetaMask:  m/44'/60'/0'/0/{index}     → vary index, account=0
 * - Ledger Live: m/44'/60'/{account}'/0/0 → vary account, index=0
 * - Legacy:    m/44'/60'/0'/{index}       → vary index, account=0
 */
export const getEvmHdScanCandidates = (
  profile: 'metamask' | 'ledgerlive' | 'legacy',
  slotCount: number = HD_SCAN_SLOT_COUNT
): HdScanCandidate[] => {
  const n = Math.max(1, Math.min(slotCount, 20))
  const out: HdScanCandidate[] = []

  for (let i = 0; i < n; i++) {
    if (profile === 'ledgerlive') {
      out.push({
        profile,
        accountLabel: i + 1,
        settings: { hdMode: 'ledgerlive' as EvmHDMode, account: i, index: 0 }
      })
    } else if (profile === 'metamask') {
      out.push({
        profile,
        accountLabel: i + 1,
        settings: { hdMode: 'metamask' as EvmHDMode, account: 0, index: i }
      })
    } else {
      out.push({
        profile,
        accountLabel: i + 1,
        settings: { hdMode: 'legacy' as EvmHDMode, account: 0, index: i }
      })
    }
  }
  return out
}

/**
 * THORChain BIP44: m/44'/931'/{account}'/0/0 — vary account only (≤5).
 */
export const getThorHdScanCandidates = (slotCount: number = HD_SCAN_SLOT_COUNT): HdScanCandidate[] => {
  const n = Math.max(1, Math.min(slotCount, 20))
  const out: HdScanCandidate[] = []
  for (let account = 0; account < n; account++) {
    out.push({
      profile: 'thor',
      accountLabel: account + 1,
      settings: { hdMode: 'default', account, index: 0 }
    })
  }
  return out
}

/**
 * Bitcoin: Native SegWit BIP84 or Taproot BIP86 — vary account, index 0 (≤5).
 */
export const getBtcHdScanCandidates = (
  profile: 'p2wpkh' | 'p2tr',
  slotCount: number = HD_SCAN_SLOT_COUNT
): HdScanCandidate[] => {
  const n = Math.max(1, Math.min(slotCount, 20))
  const hdMode: UtxoHDMode = profile
  const out: HdScanCandidate[] = []
  for (let account = 0; account < n; account++) {
    out.push({
      profile,
      accountLabel: account + 1,
      settings: { hdMode, account, index: 0 }
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
