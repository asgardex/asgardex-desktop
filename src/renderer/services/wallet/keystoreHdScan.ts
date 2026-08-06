import { Client as ArbClient, ARBChain, AssetAETH } from '@xchainjs/xchain-arbitrum'
import { Client as AvaxClient, AVAXChain, AssetAVAX } from '@xchainjs/xchain-avax'
import { Client as BaseClient, BASEChain, AssetBETH } from '@xchainjs/xchain-base'
import {
  AddressFormat,
  AssetBTC,
  BTCChain,
  Client as BitcoinClient,
  defaultBTCParams,
  tapRootDerivationPaths
} from '@xchainjs/xchain-bitcoin'
import { BCHChain, Client as BitcoinCashClient, defaultBchParams, AssetBCH } from '@xchainjs/xchain-bitcoincash'
import { Client as BscClient, BSCChain, AssetBSC } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ClientKeystore as DashClient, DASHChain, AssetDASH, defaultDashParams } from '@xchainjs/xchain-dash'
import { Client as DogeClient, DOGEChain, AssetDOGE, defaultDogeParams } from '@xchainjs/xchain-doge'
import { Client as EthClient, ETHChain, AssetETH } from '@xchainjs/xchain-ethereum'
import { Client as LtcClient, LTCChain, AssetLTC, defaultLtcParams } from '@xchainjs/xchain-litecoin'
import {
  Client as MayaClient,
  MAYAChain,
  AssetCacao,
  defaultClientConfig as mayaDefaultConfig
} from '@xchainjs/xchain-mayachain'
import {
  Client as ThorClient,
  THORChain,
  AssetRuneNative,
  defaultClientConfig as thorDefaultConfig
} from '@xchainjs/xchain-thorchain'
import { AnyAsset, BaseAmount, baseAmount, Chain } from '@xchainjs/xchain-util'
import { Client as ZecClient, ZECChain, AssetZEC, defaultZECParams } from '@xchainjs/xchain-zcash'
import * as Rx from 'rxjs'

import { createArbParams } from '../../../shared/arb/const'
import { createAvaxParams } from '../../../shared/avax/const'
import { createBaseParams } from '../../../shared/base/const'
import { createBscParams } from '../../../shared/bsc/const'
import { createEthParams } from '../../../shared/ethereum/const'
import { DEFAULT_MAYANODE_RPC_URLS } from '../../../shared/mayachain/const'
import { DEFAULT_THORNODE_RPC_URLS } from '../../../shared/thorchain/const'
import { getChainDerivationPath, getKeystoreDerivation } from '../../../shared/utils/derivationPath'
import {
  candidateKey,
  DEFAULT_HD_SCAN_RANGE,
  getHdScanCandidates,
  HdScanCandidate,
  HdScanIndexRange,
  HdScanProfile,
  isEvmHdScanChain,
  isUtxoStandardHdScanChain,
  normalizeHdScanRange,
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

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Scan timed out')), ms)
  })
  return Promise.race([p, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

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

const makeEvmCtx = (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string,
  nativeAsset: AnyAsset,
  assetTicker: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ClientClass: new (params: any) => any,
  createParams: (rpc: string, net: Network) => Record<string, unknown>
): DeriveCtx => ({
  chain,
  phrase,
  network,
  rpcUrl,
  nativeAsset,
  assetTicker,
  createClient: (p, net, rpc, rootDerivationPaths) => {
    const params = createParams(rpc, net)
    return new ClientClass({ ...params, rootDerivationPaths, network: net, phrase: p })
  }
})

const cosmosFamilyCtx = (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string,
  nativeAsset: AnyAsset,
  assetTicker: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ClientClass: new (params: any) => any,
  defaultConfig: Record<string, unknown>
): DeriveCtx => ({
  chain,
  phrase,
  network,
  rpcUrl,
  nativeAsset,
  assetTicker,
  createClient: (p, net, rpc, rootDerivationPaths) => {
    const clientUrls: Record<Network, string[]> = {
      [Network.Mainnet]: [rpc],
      [Network.Stagenet]: [rpc],
      [Network.Testnet]: [rpc]
    }
    return new ClientClass({
      ...defaultConfig,
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
  rpcUrl: '',
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

const makeUtxoCtx = (
  chain: Chain,
  phrase: string,
  network: Network,
  nativeAsset: AnyAsset,
  assetTicker: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ClientClass: new (params: any) => any,
  baseParams: Record<string, unknown>
): DeriveCtx => ({
  chain,
  phrase,
  network,
  rpcUrl: '',
  nativeAsset,
  assetTicker,
  createClient: (p, net, _rpc, rootDerivationPaths) =>
    new ClientClass({
      ...baseParams,
      phrase: p,
      network: net,
      rootDerivationPaths
    })
})

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
  if (chain === ETHChain)
    return makeEvmCtx(ETHChain, phrase, network, rpcUrl, AssetETH, 'ETH', EthClient, createEthParams)
  if (chain === BSCChain)
    return makeEvmCtx(BSCChain, phrase, network, rpcUrl, AssetBSC, 'BNB', BscClient, createBscParams)
  if (chain === AVAXChain)
    return makeEvmCtx(AVAXChain, phrase, network, rpcUrl, AssetAVAX, 'AVAX', AvaxClient, createAvaxParams)
  if (chain === ARBChain)
    return makeEvmCtx(ARBChain, phrase, network, rpcUrl, AssetAETH, 'ETH', ArbClient, createArbParams)
  if (chain === BASEChain)
    return makeEvmCtx(BASEChain, phrase, network, rpcUrl, AssetBETH, 'ETH', BaseClient, createBaseParams)
  if (chain === THORChain)
    return cosmosFamilyCtx(THORChain, phrase, network, rpcUrl, AssetRuneNative, 'RUNE', ThorClient, thorDefaultConfig)
  if (chain === MAYAChain)
    return cosmosFamilyCtx(MAYAChain, phrase, network, rpcUrl, AssetCacao, 'CACAO', MayaClient, mayaDefaultConfig)
  if (chain === BTCChain) {
    const format = btcFormatFor(profile, fullPath)
    return btcCtx(
      phrase,
      network,
      format,
      format === AddressFormat.P2TR ? tapRootDerivationPaths : defaultBTCParams.rootDerivationPaths
    )
  }
  if (chain === LTCChain) return makeUtxoCtx(LTCChain, phrase, network, AssetLTC, 'LTC', LtcClient, defaultLtcParams)
  if (chain === BCHChain)
    return makeUtxoCtx(BCHChain, phrase, network, AssetBCH, 'BCH', BitcoinCashClient, defaultBchParams)
  if (chain === DOGEChain)
    return makeUtxoCtx(DOGEChain, phrase, network, AssetDOGE, 'DOGE', DogeClient, defaultDogeParams)
  if (chain === DASHChain)
    return makeUtxoCtx(DASHChain, phrase, network, AssetDASH, 'DASH', DashClient, defaultDashParams)
  if (chain === ZECChain) return makeUtxoCtx(ZECChain, phrase, network, AssetZEC, 'ZEC', ZecClient, defaultZECParams)
  return null
}

/**
 * Scan a user-chosen index range for one profile on a supported chain.
 * Default range is 0–4; max span is capped in `normalizeHdScanRange`.
 */
export const scanKeystoreFundsForChain = async (
  chain: Chain,
  phrase: string,
  network: Network,
  rpcUrl: string,
  profile: Exclude<HdScanProfile, 'custom'>,
  range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE
): Promise<KeystoreHdScanHit[]> => {
  const ctx = ctxForChain(chain, phrase, network, rpcUrl, profile)
  if (!ctx) return []

  const candidates: HdScanCandidate[] = getHdScanCandidates(
    chain,
    profile,
    normalizeHdScanRange(range.start, range.end)
  )
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
  profile: Exclude<HdScanProfile, 'custom'>,
  range: HdScanIndexRange = DEFAULT_HD_SCAN_RANGE
): Rx.Observable<KeystoreHdScanHit[]> =>
  Rx.defer(() => scanKeystoreFundsForChain(chain, phrase, network, rpcUrl, profile, range))

export type HdScanRpcUrls = {
  eth: string
  bsc: string
  arb: string
  avax: string
  base: string
  thor: string
  maya: string
}

export const defaultRpcUrlForChain = (
  chain: Chain,
  network: Network,
  urls: HdScanRpcUrls | string,
  thorRpc?: string
): string => {
  // Backward-compat: old signature (chain, network, ethRpc, thorRpc)
  if (typeof urls === 'string') {
    if (chain === ETHChain) return urls
    if (chain === THORChain) return thorRpc || DEFAULT_THORNODE_RPC_URLS.mainnet
    return ''
  }
  if (chain === ETHChain) return urls.eth
  if (chain === BSCChain) return urls.bsc
  if (chain === ARBChain) return urls.arb
  if (chain === AVAXChain) return urls.avax
  if (chain === BASEChain) return urls.base
  if (chain === THORChain) return urls.thor || DEFAULT_THORNODE_RPC_URLS.mainnet
  if (chain === MAYAChain) return urls.maya || DEFAULT_MAYANODE_RPC_URLS.mainnet
  // UTXO chains use public data providers
  if (chain === BTCChain || isUtxoStandardHdScanChain(chain)) return ''
  if (isEvmHdScanChain(chain)) return urls.eth
  return ''
}
