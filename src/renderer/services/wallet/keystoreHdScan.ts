import { Network } from '@xchainjs/xchain-client'
import { Client as EthClient, ETHChain, AssetETH } from '@xchainjs/xchain-ethereum'
import { BaseAmount, baseAmount, Chain } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'

import { createEthParams } from '../../../shared/ethereum/const'
import { getChainDerivationPath, getKeystoreDerivation } from '../../../shared/utils/derivationPath'
import {
  candidateKey,
  getHdScanCandidates,
  HdScanCandidate,
  HdScanProfile,
  settingsFromCustomPath
} from '../../../shared/utils/keystoreHdScan'
import { KeystoreChainHDSettings } from '../../../shared/wallet/types'
import { eqAsset } from '../../helpers/fp/eq'
import { logger } from '../../helpers/logger'

export type KeystoreHdScanHit = {
  key: string
  settings: KeystoreChainHDSettings
  address: string
  amount: BaseAmount
  path: string
  profile: Exclude<HdScanProfile, 'custom'> | 'custom'
  accountLabel: number
  hasFunds: boolean
  error?: string
}

const SCAN_CONCURRENCY = 3
const SCAN_TIMEOUT_MS = 12_000

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Scan timed out')), ms)
    })
  ])

const mapPool = async <T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

const deriveEthHit = async (
  settings: KeystoreChainHDSettings,
  phrase: string,
  network: Network,
  rpcUrl: string,
  meta: { profile: KeystoreHdScanHit['profile']; accountLabel: number }
): Promise<KeystoreHdScanHit> => {
  const path =
    settings.customPath?.trim() ||
    getChainDerivationPath(ETHChain, settings.account, settings.index, network, settings.hdMode).path
  const key = candidateKey({ settings })

  try {
    const { rootDerivationPaths, walletIndex } = getKeystoreDerivation(ETHChain, settings)
    const params = createEthParams(rpcUrl, network)
    const client = new EthClient({
      ...params,
      rootDerivationPaths,
      network,
      phrase
    })
    const address = await withTimeout(client.getAddressAsync(walletIndex), SCAN_TIMEOUT_MS)
    const balances = await withTimeout(client.getBalance(address), SCAN_TIMEOUT_MS)
    const ethBal = balances.find((b) => eqAsset.equals(b.asset, AssetETH))
    const amount = ethBal?.amount ?? baseAmount(0)
    return {
      key,
      settings,
      address,
      amount,
      path,
      profile: meta.profile,
      accountLabel: meta.accountLabel,
      hasFunds: amount.gt(baseAmount(0))
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn('keystore HD scan candidate failed', { path, error: msg })
    return {
      key,
      settings,
      address: '',
      amount: baseAmount(0),
      path,
      profile: meta.profile,
      accountLabel: meta.accountLabel,
      hasFunds: false,
      error: msg
    }
  }
}

const sortHits = (hits: KeystoreHdScanHit[]): KeystoreHdScanHit[] =>
  hits.sort((a, b) => {
    if (a.hasFunds !== b.hasFunds) return a.hasFunds ? -1 : 1
    if (!!a.error !== !!b.error) return a.error ? 1 : -1
    if (a.hasFunds && b.hasFunds) {
      const cmp = b.amount.amount().comparedTo(a.amount.amount()) ?? 0
      if (cmp !== 0) return cmp
    }
    return a.accountLabel - b.accountLabel
  })

/**
 * Scan ≤5 paths for one wallet profile (MetaMask / Ledger Live / Legacy).
 */
export const scanEthKeystoreFunds = async (
  phrase: string,
  network: Network,
  rpcUrl: string,
  profile: Exclude<HdScanProfile, 'custom'>
): Promise<KeystoreHdScanHit[]> => {
  const candidates: HdScanCandidate[] = getHdScanCandidates(ETHChain, profile)
  const hits = await mapPool(candidates, SCAN_CONCURRENCY, (c) =>
    deriveEthHit(c.settings, phrase, network, rpcUrl, {
      profile: c.profile,
      accountLabel: c.accountLabel
    })
  )
  return sortHits(hits)
}

/** Derive + balance for a single custom BIP path. */
export const checkEthCustomPath = async (
  phrase: string,
  network: Network,
  rpcUrl: string,
  fullPath: string
): Promise<KeystoreHdScanHit> => {
  const settings = settingsFromCustomPath(fullPath)
  return deriveEthHit(settings, phrase, network, rpcUrl, { profile: 'custom', accountLabel: 0 })
}

export const scanKeystoreFundsForChain = async (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string,
  profile: Exclude<HdScanProfile, 'custom'>
): Promise<KeystoreHdScanHit[]> => {
  if (chain === ETHChain) return scanEthKeystoreFunds(phrase, network, rpcUrl, profile)
  return []
}

export const scanKeystoreFunds$ = (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string,
  profile: Exclude<HdScanProfile, 'custom'>
): Rx.Observable<KeystoreHdScanHit[]> => Rx.from(scanKeystoreFundsForChain(chain, phrase, network, rpcUrl, profile))
