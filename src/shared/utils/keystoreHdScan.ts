import { ETHChain } from '@xchainjs/xchain-ethereum'
import { Chain } from '@xchainjs/xchain-util'

import { EvmHDMode } from '../evm/types'
import { KeystoreChainHDSettings } from '../wallet/types'

/** Accounts 1–5 in the UI (0-based indices 0–4). */
export const EVM_HD_SCAN_ACCOUNT_COUNT = 5

/** Human-facing standard id used for i18n labels. */
export type EvmHdScanModeLabel = 'standard' | 'metamask' | 'legacy'

export type HdScanCandidate = {
  settings: KeystoreChainHDSettings
  /** 1-based account number for display */
  accountLabel: number
  modeLabel: EvmHdScanModeLabel
}

const EVM_MODES: { mode: EvmHDMode; modeLabel: EvmHdScanModeLabel }[] = [
  { mode: 'ledgerlive', modeLabel: 'standard' },
  { mode: 'metamask', modeLabel: 'metamask' },
  { mode: 'legacy', modeLabel: 'legacy' }
]

/**
 * Common EVM derivation candidates for "Find my funds" scan.
 * Index is fixed at 0 (MetaMask / Ledger Live "accounts" map to BIP44 account).
 */
export const getEvmHdScanCandidates = (accountCount: number = EVM_HD_SCAN_ACCOUNT_COUNT): HdScanCandidate[] => {
  const n = Math.max(1, Math.min(accountCount, 20))
  const out: HdScanCandidate[] = []
  for (const { mode, modeLabel } of EVM_MODES) {
    for (let account = 0; account < n; account++) {
      out.push({
        settings: { hdMode: mode, account, index: 0 },
        accountLabel: account + 1,
        modeLabel
      })
    }
  }
  return out
}

/** Chains wired for the EVM scan matrix (ETH pilot first). */
export const chainSupportsEvmHdScan = (chain: Chain): boolean => chain === ETHChain

/**
 * Candidate set for a chain. ETH pilot uses EVM matrix; other chains empty until wired.
 */
export const getHdScanCandidates = (chain: Chain, accountCount?: number): HdScanCandidate[] => {
  if (chainSupportsEvmHdScan(chain)) return getEvmHdScanCandidates(accountCount)
  return []
}

export const candidateKey = (c: Pick<HdScanCandidate, 'settings'>): string => {
  const { hdMode, account, index, customPath } = c.settings
  return customPath ? `custom:${customPath}` : `${hdMode}:${account}:${index}`
}
