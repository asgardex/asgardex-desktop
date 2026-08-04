import {
  AddressFormat,
  AssetBTC,
  BTCChain,
  Client as BitcoinClient,
  defaultBTCParams,
  tapRootDerivationPaths
} from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { Client as EthClient, ETHChain, AssetETH } from '@xchainjs/xchain-ethereum'
import {
  Client as ThorClient,
  THORChain,
  AssetRuneNative,
  defaultClientConfig as thorDefaultConfig
} from '@xchainjs/xchain-thorchain'
import { AnyAsset, BaseAmount, baseAmount, Chain } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'

import { createEthParams } from '../../../shared/ethereum/const'
import { DEFAULT_THORNODE_RPC_URLS } from '../../../shared/thorchain/const'
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
  /** Display asset ticker for balance column */
  assetTicker: string
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

type DeriveCtx = {
  chain: Chain
  phrase: string
  network: Network
  rpcUrl: string
  nativeAsset: AnyAsset
  assetTicker: string
  createClient: (
    phrase: string,
    network: Network,
    rpcUrl: string,
    rootDerivationPaths: ReturnType<typeof getKeystoreDerivation>['rootDerivationPaths']
  ) => {
    getAddressAsync: (i: number) => Promise<string>
    getBalance: (a: string) => Promise<{ asset: AnyAsset; amount: BaseAmount }[]>
  }
}

const deriveHit = async (
  settings: KeystoreChainHDSettings,
  ctx: DeriveCtx,
  meta: { profile: KeystoreHdScanHit['profile']; accountLabel: number }
): Promise<KeystoreHdScanHit> => {
  const path =
    settings.customPath?.trim() ||
    getChainDerivationPath(ctx.chain, settings.account, settings.index, ctx.network, settings.hdMode).path
  const key = candidateKey({ settings })

  try {
    const { rootDerivationPaths, walletIndex } = getKeystoreDerivation(ctx.chain, settings)
    const client = ctx.createClient(ctx.phrase, ctx.network, ctx.rpcUrl, rootDerivationPaths)
    const address = await withTimeout(client.getAddressAsync(walletIndex), SCAN_TIMEOUT_MS)
    const balances = await withTimeout(client.getBalance(address), SCAN_TIMEOUT_MS)
    const native = balances.find((b) => eqAsset.equals(b.asset, ctx.nativeAsset))
    const amount = native?.amount ?? baseAmount(0)
    return {
      key,
      settings,
      address,
      amount,
      path,
      profile: meta.profile,
      accountLabel: meta.accountLabel,
      hasFunds: amount.gt(baseAmount(0)),
      assetTicker: ctx.assetTicker
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn('keystore HD scan candidate failed', { chain: ctx.chain, path, error: msg })
    return {
      key,
      settings,
      address: '',
      amount: baseAmount(0),
      path,
      profile: meta.profile,
      accountLabel: meta.accountLabel,
      hasFunds: false,
      assetTicker: ctx.assetTicker,
      error: msg
    }
  }
}

const ethCtx = (phrase: string, network: Network, rpcUrl: string): DeriveCtx => ({
  chain: ETHChain,
  phrase,
  network,
  rpcUrl,
  nativeAsset: AssetETH,
  assetTicker: 'ETH',
  createClient: (p, net, rpc, rootDerivationPaths) => {
    const params = createEthParams(rpc, net)
    return new EthClient({ ...params, rootDerivationPaths, network: net, phrase: p })
  }
})

const thorCtx = (phrase: string, network: Network, rpcUrl: string): DeriveCtx => ({
  chain: THORChain,
  phrase,
  network,
  rpcUrl,
  nativeAsset: AssetRuneNative,
  assetTicker: 'RUNE',
  createClient: (p, net, rpc, rootDerivationPaths) => {
    const clientUrls: Record<Network, string[]> = {
      [Network.Mainnet]: [rpc],
      [Network.Stagenet]: [rpc],
      [Network.Testnet]: [rpc]
    }
    return new ThorClient({
      ...thorDefaultConfig,
      clientUrls,
      rootDerivationPaths,
      network: net,
      phrase: p
    })
  }
})

const btcCtx = (
  phrase: string,
  network: Network,
  addressFormat: AddressFormat,
  fallbackPaths: typeof defaultBTCParams.rootDerivationPaths
): DeriveCtx => ({
  chain: BTCChain,
  phrase,
  network,
  rpcUrl: '', // unused — BTC uses dataProviders
  nativeAsset: AssetBTC,
  assetTicker: 'BTC',
  createClient: (p, net, _rpc, rootDerivationPaths) =>
    new BitcoinClient({
      ...defaultBTCParams,
      phrase: p,
      network: net,
      addressFormat,
      rootDerivationPaths: rootDerivationPaths ?? fallbackPaths,
      feeBounds: defaultBTCParams.feeBounds
    })
})

/** Infer BTC address format from profile or custom path (86' → Taproot). */
const btcFormatFor = (profile: Exclude<HdScanProfile, 'custom'> | 'custom', fullPath?: string): AddressFormat => {
  if (profile === 'p2tr') return AddressFormat.P2TR
  if (profile === 'custom' && fullPath?.includes("86'")) return AddressFormat.P2TR
  return AddressFormat.P2WPKH
}

const ctxForChain = (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string,
  profile: Exclude<HdScanProfile, 'custom'> | 'custom' = 'metamask',
  fullPath?: string
): DeriveCtx | null => {
  if (chain === ETHChain) return ethCtx(phrase, network, rpcUrl)
  if (chain === THORChain) return thorCtx(phrase, network, rpcUrl)
  if (chain === BTCChain) {
    const format = btcFormatFor(profile, fullPath)
    return btcCtx(
      phrase,
      network,
      format,
      format === AddressFormat.P2TR ? tapRootDerivationPaths : defaultBTCParams.rootDerivationPaths
    )
  }
  return null
}

/**
 * Scan ≤5 paths for one profile on a supported chain.
 */
export const scanKeystoreFundsForChain = async (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string,
  profile: Exclude<HdScanProfile, 'custom'>
): Promise<KeystoreHdScanHit[]> => {
  const ctx = ctxForChain(chain, phrase, network, rpcUrl, profile)
  if (!ctx) return []

  const candidates: HdScanCandidate[] = getHdScanCandidates(chain, profile)
  const hits = await mapPool(candidates, SCAN_CONCURRENCY, (c) =>
    deriveHit(c.settings, ctx, { profile: c.profile, accountLabel: c.accountLabel })
  )
  return sortHits(hits)
}

/** Derive + balance for a single custom BIP path. */
export const checkCustomPath = async (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string,
  fullPath: string
): Promise<KeystoreHdScanHit> => {
  const settings = settingsFromCustomPath(fullPath)
  // Tag BTC custom path with matching hdMode for dual-client wiring
  if (chain === BTCChain) {
    settings.hdMode = fullPath.includes("86'") ? 'p2tr' : 'p2wpkh'
  }
  const ctx = ctxForChain(chain, phrase, network, rpcUrl, 'custom', fullPath)
  if (!ctx) {
    return {
      key: `custom:${fullPath}`,
      settings,
      address: '',
      amount: baseAmount(0),
      path: fullPath,
      profile: 'custom',
      accountLabel: 0,
      hasFunds: false,
      assetTicker: '',
      error: `Scan not supported for ${chain}`
    }
  }
  return deriveHit(settings, ctx, { profile: 'custom', accountLabel: 0 })
}

/** @deprecated use checkCustomPath */
export const checkEthCustomPath = (
  phrase: string,
  network: Network,
  rpcUrl: string,
  fullPath: string
): Promise<KeystoreHdScanHit> => checkCustomPath(ETHChain, phrase, network, rpcUrl, fullPath)

export const scanKeystoreFunds$ = (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string,
  profile: Exclude<HdScanProfile, 'custom'>
): Rx.Observable<KeystoreHdScanHit[]> => Rx.from(scanKeystoreFundsForChain(chain, phrase, network, rpcUrl, profile))

export const defaultRpcUrlForChain = (chain: Chain, network: Network, ethRpc: string, thorRpc: string): string => {
  if (chain === ETHChain) return ethRpc
  if (chain === THORChain) return thorRpc || DEFAULT_THORNODE_RPC_URLS.mainnet
  if (chain === BTCChain) return '' // BTC uses public data providers
  return ''
}
