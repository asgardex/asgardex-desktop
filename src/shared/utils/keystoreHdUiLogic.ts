import { Network } from '@xchainjs/xchain-client'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

import { getChainDerivationPath } from './derivationPath'
import {
  DEFAULT_HD_SCAN_RANGE,
  HD_SCAN_MAX_INDEX,
  HdScanIndexRange,
  HdScanProfile,
  isEvmHdScanChain,
  isUtxoStandardHdScanChain,
  normalizeHdScanRange
} from './keystoreHdScan'
import { KeystoreChainHDSettings } from '../wallet/types'

export type HdProfileOption = Exclude<HdScanProfile, 'custom'>

export type HdProfileCard = { id: HdProfileOption; titleId: string; hintId: string }

export const EVM_HD_PROFILES: HdProfileCard[] = [
  {
    id: 'metamask',
    titleId: 'settings.wallet.hd.profile.metamask',
    hintId: 'settings.wallet.hd.profile.metamask.hint'
  },
  {
    id: 'legacy',
    titleId: 'settings.wallet.hd.profile.legacy',
    hintId: 'settings.wallet.hd.profile.legacy.hint'
  }
]

export const THOR_HD_PROFILES: HdProfileCard[] = [
  {
    id: 'thor',
    titleId: 'settings.wallet.hd.profile.thor',
    hintId: 'settings.wallet.hd.profile.thor.hint'
  }
]

export const MAYA_HD_PROFILES: HdProfileCard[] = [
  {
    id: 'maya',
    titleId: 'settings.wallet.hd.profile.maya',
    hintId: 'settings.wallet.hd.profile.maya.hint'
  }
]

export const BTC_HD_PROFILES: HdProfileCard[] = [
  {
    id: 'p2wpkh',
    titleId: 'settings.wallet.hd.profile.p2wpkh',
    hintId: 'settings.wallet.hd.profile.p2wpkh.hint'
  },
  {
    id: 'p2tr',
    titleId: 'settings.wallet.hd.profile.p2tr',
    hintId: 'settings.wallet.hd.profile.p2tr.hint'
  }
]

export const UTXO_HD_PROFILES: HdProfileCard[] = [
  {
    id: 'utxo',
    titleId: 'settings.wallet.hd.profile.utxo',
    hintId: 'settings.wallet.hd.profile.utxo.hint'
  }
]

export const profilesForChain = (chain: Chain): HdProfileCard[] => {
  if (isEvmHdScanChain(chain)) return EVM_HD_PROFILES
  if (chain === THORChain) return THOR_HD_PROFILES
  if (chain === MAYAChain) return MAYA_HD_PROFILES
  if (chain === BTCChain) return BTC_HD_PROFILES
  if (isUtxoStandardHdScanChain(chain)) return UTXO_HD_PROFILES
  return []
}

export const defaultProfileForChain = (chain: Chain): HdProfileOption => {
  if (chain === THORChain) return 'thor'
  if (chain === MAYAChain) return 'maya'
  if (chain === BTCChain) return 'p2wpkh'
  if (isUtxoStandardHdScanChain(chain)) return 'utxo'
  return 'metamask'
}

/** Parse a draft range field; empty/invalid falls back. */
export const parseScanDraftIndex = (raw: string, fallback: number): number => {
  if (raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return fallback
  return Math.min(n, HD_SCAN_MAX_INDEX)
}

export const scanRangeFromDrafts = (draftStart: string, draftEnd: string): HdScanIndexRange =>
  normalizeHdScanRange(
    parseScanDraftIndex(draftStart, DEFAULT_HD_SCAN_RANGE.start),
    parseScanDraftIndex(draftEnd, DEFAULT_HD_SCAN_RANGE.end)
  )

export type ScanHitLike = {
  key: string
  address: string
  hasFunds: boolean
}

/**
 * Default selection after a scan succeeds:
 * current locked key → first funded → first with address.
 */
export const pickDefaultScanSelection = (hits: ScanHitLike[], currentKey: string | null): string | null => {
  const withAddress = hits.filter((h) => !!h.address)
  if (withAddress.length === 0) return null
  const currentHit = currentKey ? withAddress.find((h) => h.key === currentKey) : undefined
  const funded = withAddress.find((h) => h.hasFunds)
  return currentHit?.key ?? funded?.key ?? withAddress[0]?.key ?? null
}

/** Quiet-row account/index chip parse. */
export const parseSlotDraft = (raw: string, fallback: number): number => {
  if (raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return fallback
  return Math.min(n, 2_147_483_647)
}

export const slotsAreDirty = (
  draftAccount: number,
  draftIndex: number,
  locked: Pick<KeystoreChainHDSettings, 'account' | 'index'>
): boolean => draftAccount !== locked.account || draftIndex !== locked.index

/** Save is only for dirty slots (drops custom path when applied). */
export const accountIndexSaveEnabled = (dirty: boolean, saving: boolean): boolean => !saving && dirty

/**
 * Path preview on the quiet row:
 * - custom path shown while slots match locked settings
 * - otherwise live formula from draft account/index
 */
export const quietRowPreviewPath = (
  chain: Chain,
  network: Network,
  settings: KeystoreChainHDSettings,
  draftAccount: number,
  draftIndex: number
): string => {
  const hasCustom = !!settings.customPath?.trim()
  const dirty = slotsAreDirty(draftAccount, draftIndex, settings)
  if (hasCustom && !dirty) return settings.customPath!.trim()
  return getChainDerivationPath(chain, draftAccount, draftIndex, network, settings.hdMode).path
}

export const defaultCustomPathForChain = (chain: Chain, network: Network): string => {
  if (chain === BTCChain) return getChainDerivationPath(chain, 0, 0, network, 'p2wpkh').path
  if (isEvmHdScanChain(chain)) return getChainDerivationPath(chain, 0, 0, network, 'ledgerlive').path
  return getChainDerivationPath(chain, 0, 0, network).path
}

export const initialCustomPathFromSettings = (
  chain: Chain,
  network: Network,
  settings: Pick<KeystoreChainHDSettings, 'customPath' | 'account' | 'index' | 'hdMode'>
): string => {
  if (settings.customPath?.trim()) return settings.customPath.trim()
  return getChainDerivationPath(chain, settings.account, settings.index, network, settings.hdMode).path
}
