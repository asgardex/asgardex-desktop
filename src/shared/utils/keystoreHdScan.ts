import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'

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
 * - EVM: metamask/legacy (ledgerlive kept for API compat; UI merges with metamask)
 * - THOR / MAYA: thor | maya (both BIP44 coin-type 931)
 * - BTC: p2wpkh / p2tr
 * - Other UTXO: utxo (single BIP formula per chain)
 */
export type HdScanProfile =
  | 'metamask'
  | 'ledgerlive'
  | 'legacy'
  | 'thor'
  | 'maya'
  | 'p2wpkh'
  | 'p2tr'
  | 'utxo'
  | 'custom'

export type HdScanCandidate = {
  settings: KeystoreChainHDSettings
  /** 1-based sort key (index + 1); UI shows zero-based `settings.index` */
  accountLabel: number
  profile: Exclude<HdScanProfile, 'custom'>
}

const EVM_SCAN_CHAINS: Chain[] = [ETHChain, BSCChain, AVAXChain, ARBChain, BASEChain]
const UTXO_STANDARD_SCAN_CHAINS: Chain[] = [LTCChain, BCHChain, DOGEChain, DASHChain, ZECChain]

export const isEvmHdScanChain = (chain: Chain): boolean => EVM_SCAN_CHAINS.includes(chain)
export const isUtxoStandardHdScanChain = (chain: Chain): boolean => UTXO_STANDARD_SCAN_CHAINS.includes(chain)

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
 * - MetaMask / Ledger Live account 0: m/44'/60'/0'/0/{index}
 * - Legacy: m/44'/60'/0'/{index}
 */
export const getEvmHdScanCandidates = (
  profile: 'metamask' | 'ledgerlive' | 'legacy',
  range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE
): HdScanCandidate[] => {
  const hdMode: EvmHDMode = profile === 'ledgerlive' ? 'ledgerlive' : profile === 'metamask' ? 'metamask' : 'legacy'
  return candidatesForRange(profile, range, (index) => ({ hdMode, account: 0, index }))
}

/** THOR / MAYA BIP44: m/44'/931'/0'/0/{index} */
export const getThorHdScanCandidates = (range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE): HdScanCandidate[] =>
  candidatesForRange('thor', range, (index) => ({ hdMode: 'default', account: 0, index }))

export const getMayaHdScanCandidates = (range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE): HdScanCandidate[] =>
  candidatesForRange('maya', range, (index) => ({ hdMode: 'default', account: 0, index }))

/** Bitcoin: BIP84 P2WPKH or BIP86 P2TR */
export const getBtcHdScanCandidates = (
  profile: 'p2wpkh' | 'p2tr',
  range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE
): HdScanCandidate[] => {
  const hdMode: UtxoHDMode = profile
  return candidatesForRange(profile, range, (index) => ({ hdMode, account: 0, index }))
}

/**
 * Other UTXO (LTC/BCH/DOGE/DASH/ZEC): single standard formula from derivationPath,
 * vary address index, account 0.
 */
export const getUtxoStandardHdScanCandidates = (range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE): HdScanCandidate[] =>
  candidatesForRange('utxo', range, (index) => ({ hdMode: 'default', account: 0, index }))

export const chainSupportsHdScan = (chain: Chain): boolean =>
  isEvmHdScanChain(chain) ||
  chain === THORChain ||
  chain === MAYAChain ||
  chain === BTCChain ||
  isUtxoStandardHdScanChain(chain)

export const getHdScanCandidates = (
  chain: Chain,
  profile: Exclude<HdScanProfile, 'custom'>,
  range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE
): HdScanCandidate[] => {
  if (isEvmHdScanChain(chain)) {
    if (profile === 'metamask' || profile === 'ledgerlive' || profile === 'legacy') {
      return getEvmHdScanCandidates(profile, range)
    }
    return []
  }
  if (chain === THORChain) {
    if (profile !== 'thor') return []
    return getThorHdScanCandidates(range)
  }
  if (chain === MAYAChain) {
    if (profile !== 'maya') return []
    return getMayaHdScanCandidates(range)
  }
  if (chain === BTCChain) {
    if (profile === 'p2wpkh' || profile === 'p2tr') return getBtcHdScanCandidates(profile, range)
    return []
  }
  if (isUtxoStandardHdScanChain(chain)) {
    if (profile !== 'utxo') return []
    return getUtxoStandardHdScanCandidates(range)
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
