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
  EvmHdScanModeLabel
} from '../../../shared/utils/keystoreHdScan'
import { KeystoreChainHDSettings } from '../../../shared/wallet/types'
import { logger } from '../../helpers/logger'
import { eqAsset } from '../../helpers/fp/eq'

export type KeystoreHdScanHit = {
  key: string
  settings: KeystoreChainHDSettings
  address: string
  /** Native chain balance (e.g. ETH). Zero if empty or fetch failed. */
  amount: BaseAmount
  path: string
  modeLabel: EvmHdScanModeLabel
  accountLabel: number
  /** True when native balance > 0 */
  hasFunds: boolean
  /** Balance fetch / derive error (row still shown) */
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

/**
 * Run async work over items with a fixed concurrency limit.
 */
const mapPool = async <T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

const scanOneEth = async (
  candidate: HdScanCandidate,
  phrase: string,
  network: Network,
  rpcUrl: string
): Promise<KeystoreHdScanHit> => {
  const { settings, accountLabel, modeLabel } = candidate
  const path = getChainDerivationPath(ETHChain, settings.account, settings.index, network, settings.hdMode).path
  const key = candidateKey(candidate)

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
      modeLabel,
      accountLabel,
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
      modeLabel,
      accountLabel,
      hasFunds: false,
      error: msg
    }
  }
}

/**
 * Scan common ETH derivation paths for native balance.
 * Does not mutate live client$ — uses ephemeral clients per candidate.
 */
export const scanEthKeystoreFunds = async (
  phrase: string,
  network: Network,
  rpcUrl: string
): Promise<KeystoreHdScanHit[]> => {
  const candidates = getHdScanCandidates(ETHChain)
  const hits = await mapPool(candidates, SCAN_CONCURRENCY, (c) => scanOneEth(c, phrase, network, rpcUrl))

  // Funded first (desc), then successes without funds, then errors; stable by path
  return hits.sort((a, b) => {
    if (a.hasFunds !== b.hasFunds) return a.hasFunds ? -1 : 1
    if (!!a.error !== !!b.error) return a.error ? 1 : -1
    if (a.hasFunds && b.hasFunds) {
      const cmp = b.amount.amount().comparedTo(a.amount.amount()) ?? 0
      if (cmp !== 0) return cmp
    }
    return a.path.localeCompare(b.path)
  })
}

export const scanKeystoreFundsForChain = async (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string
): Promise<KeystoreHdScanHit[]> => {
  if (chain === ETHChain) return scanEthKeystoreFunds(phrase, network, rpcUrl)
  return []
}

/** Observable wrapper for UI. */
export const scanKeystoreFunds$ = (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string
): Rx.Observable<KeystoreHdScanHit[]> => Rx.from(scanKeystoreFundsForChain(chain, phrase, network, rpcUrl))
