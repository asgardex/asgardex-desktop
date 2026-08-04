import { ETHChain } from '@xchainjs/xchain-ethereum'
import { Chain } from '@xchainjs/xchain-util'

import { EvmHDMode } from '../evm/types'
import { KeystoreChainHDSettings } from '../wallet/types'

/** Max accounts/indices scanned for one profile (Accounts 1–5 in the UI). */
export const EVM_HD_SCAN_SLOT_COUNT = 5

/**
 * Wallet profile the user picks before scanning.
 * Determines which path formula to use — not a cartesian product of all modes.
 */
export type HdScanProfile = 'metamask' | 'ledgerlive' | 'legacy' | 'custom'

export type HdScanCandidate = {
  settings: KeystoreChainHDSettings
  /** 1-based “Account N” label in the UI */
  accountLabel: number
  profile: Exclude<HdScanProfile, 'custom'>
}

/**
 * Candidates for a single profile (≤5).
 *
 * - MetaMask:  m/44'/60'/0'/0/{index}     → vary index, account=0
 * - Ledger Live: m/44'/60'/{account}'/0/0 → vary account, index=0
 * - Legacy:    m/44'/60'/0'/{index}       → vary index, account=0
 */
export const getEvmHdScanCandidates = (
  profile: Exclude<HdScanProfile, 'custom'>,
  slotCount: number = EVM_HD_SCAN_SLOT_COUNT
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
      // legacy
      out.push({
        profile,
        accountLabel: i + 1,
        settings: { hdMode: 'legacy' as EvmHDMode, account: 0, index: i }
      })
    }
  }
  return out
}

export const chainSupportsEvmHdScan = (chain: Chain): boolean => chain === ETHChain

export const getHdScanCandidates = (
  chain: Chain,
  profile: Exclude<HdScanProfile, 'custom'>,
  slotCount?: number
): HdScanCandidate[] => {
  if (!chainSupportsEvmHdScan(chain)) return []
  return getEvmHdScanCandidates(profile, slotCount)
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
