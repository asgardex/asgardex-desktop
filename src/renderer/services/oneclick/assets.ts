import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { NEARAsset, NEARChain } from '@xchainjs/xchain-near'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain } from '@xchainjs/xchain-solana'
import { SUIChain } from '@xchainjs/xchain-sui'
import {
  AnyAsset,
  Asset,
  AssetType,
  CachedValue,
  Chain,
  TokenAsset,
  assetToString,
  isSecuredAsset,
  isSynthAsset,
  isTradeAsset
} from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ASGARDEX_ONECLICK_API_KEY } from '../../../shared/const'
import { createScopedLogger } from '../../helpers/logger'

const logger = createScopedLogger('oneclick')

// Subset of 1Click's /v0/tokens payload we use
type OneClickToken = {
  assetId: string
  blockchain: string
  symbol: string
  decimals: number
  contractAddress?: string
  price?: number
}

// Mirrors the aggregator's internal ONECLICK_TO_X map, which isn't exported
// from @xchainjs/xchain-aggregator's package root. Keep in sync on upgrades.
const ONECLICK_TO_XCHAIN: Record<string, Chain> = {
  btc: BTCChain,
  eth: ETHChain,
  arb: ARBChain,
  avax: AVAXChain,
  bsc: BSCChain,
  sol: SOLChain,
  doge: DOGEChain,
  dash: DASHChain,
  ltc: LTCChain,
  bch: BCHChain,
  xrp: XRPChain,
  cardano: ADAChain,
  sui: SUIChain,
  near: NEARChain
}

/** 1Click lists native NEAR as wNEAR (wrap.near), not a contract-less native entry. */
const isOneClickNativeNearToken = (token: OneClickToken): boolean =>
  token.blockchain === 'near' &&
  (token.contractAddress === 'wrap.near' ||
    token.assetId === 'nep141:wrap.near' ||
    token.symbol.toUpperCase() === 'WNEAR')

/**
 * Chain-level OneClick support, used as a fallback while the token list hasn't
 * loaded (or the API is down). Derived from the chain map so it can't drift
 * from the routing the aggregator actually supports.
 */
export const ONECLICK_FALLBACK_CHAINS: Chain[] = Object.values(ONECLICK_TO_XCHAIN)

const ONECLICK_TOKENS_URL = 'https://1click.chaindefuser.com/v0/tokens'
const ONECLICK_TOKENS_TIMEOUT_MS = 15_000

const fetchTokens = async (): Promise<OneClickToken[]> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ASGARDEX_ONECLICK_API_KEY) headers['Authorization'] = `Bearer ${ASGARDEX_ONECLICK_API_KEY}`
  const resp = await fetch(ONECLICK_TOKENS_URL, { headers, signal: AbortSignal.timeout(ONECLICK_TOKENS_TIMEOUT_MS) })
  if (!resp.ok) throw new Error(`1Click getTokens failed: ${resp.status} ${resp.statusText}`)
  return resp.json()
}

// The token list changes rarely — same 24h cache the aggregator uses internally.
const tokensCache = new CachedValue<OneClickToken[]>(() => fetchTokens(), 24 * 60 * 60 * 1000)

// Same symbol convention as the rest of the app (and Chainflip's cAssetToXAsset):
// `TICKER-CONTRACT` for tokens, plain ticker for natives.
// Native NEAR is special-cased to NEARAsset so wallet balances / swap UI match
// aggregator ≥3.1.0 (which maps NEAR.NEAR ↔ wrap.near).
const oneClickTokenToXAsset = (token: OneClickToken): Asset | TokenAsset | null => {
  const chain = ONECLICK_TO_XCHAIN[token.blockchain]
  if (!chain) return null
  if (isOneClickNativeNearToken(token)) return NEARAsset
  return {
    chain,
    symbol: token.contractAddress ? `${token.symbol}-${token.contractAddress}` : token.symbol,
    ticker: token.symbol,
    type: token.contractAddress ? AssetType.TOKEN : AssetType.NATIVE
  }
}

// Latest successfully fetched token/asset lists. Kept in module snapshots so
// `isOneClickSupportedAsset` / `getOneClickUsdPrice` can stay synchronous —
// the swap asset filters, protocol validation and fee checks are sync paths.
let assetsSnapshot: ReadonlyArray<Asset | TokenAsset> | null = null
let tokensSnapshot: ReadonlyArray<OneClickToken> | null = null

const XCHAIN_TO_ONECLICK: Record<string, string> = Object.fromEntries(
  Object.entries(ONECLICK_TO_XCHAIN).map(([blockchain, chain]) => [chain, blockchain])
)

const toAssets = (tokens: OneClickToken[]): (Asset | TokenAsset)[] =>
  tokens.map(oneClickTokenToXAsset).filter((asset): asset is Asset | TokenAsset => asset !== null)

export type OneClickAssetsRD = RD.RemoteData<Error, (Asset | TokenAsset)[]>

/**
 * Assets routable via OneClick (NEAR Intents), from 1Click's /v0/tokens API.
 * Failures degrade to an empty success so THOR/MAYA/Chainflip swaps keep
 * working and the chain-level fallback keeps OneClick pairs quotable.
 */
export const getAssetsData$ = (): Rx.Observable<OneClickAssetsRD> =>
  Rx.defer(() => tokensCache.getValue()).pipe(
    RxOp.map((tokens): OneClickAssetsRD => {
      const assets = toAssets(tokens)
      assetsSnapshot = assets
      tokensSnapshot = tokens
      return RD.success(assets)
    }),
    RxOp.catchError((error): Rx.Observable<OneClickAssetsRD> => {
      logger.warn('1Click tokens unavailable, falling back to chain-level support', error)
      return Rx.of(RD.success([]))
    }),
    RxOp.shareReplay(1)
  )

/**
 * Synchronous OneClick support check: exact (full asset identity against the
 * fetched token list, contract addresses compared case-insensitively) once the
 * list has loaded; chain-level fallback before that or when the API is down.
 * Synth/trade/secured assets are protocol-specific and never route via 1Click.
 */
export const isOneClickSupportedAsset = (asset: AnyAsset): boolean => {
  if (isSynthAsset(asset) || isTradeAsset(asset) || isSecuredAsset(asset)) return false
  if (assetsSnapshot && assetsSnapshot.length > 0) {
    const target = assetToString(asset).toLowerCase()
    return assetsSnapshot.some((supported) => assetToString(supported).toLowerCase() === target)
  }
  return ONECLICK_FALLBACK_CHAINS.includes(asset.chain)
}

/**
 * Synchronous USD price for an asset from 1Click's token list (their /v0/tokens
 * payload carries a `price` per token). Returns undefined until the list has
 * loaded or when the asset isn't in it. Matching mirrors the aggregator's
 * findOneClickToken: tokens by contract address (case-insensitive, taken from
 * the `TICKER-CONTRACT` symbol convention), natives by plain symbol.
 */
export const getOneClickUsdPrice = (asset: AnyAsset): number | undefined => {
  if (isSynthAsset(asset) || isTradeAsset(asset) || isSecuredAsset(asset)) return undefined
  if (!tokensSnapshot) return undefined
  const blockchain = XCHAIN_TO_ONECLICK[asset.chain]
  if (!blockchain) return undefined

  const contract = asset.symbol.includes('-') ? asset.symbol.split('-')[1] : undefined
  const token = tokensSnapshot.find((t) => {
    if (t.blockchain !== blockchain) return false
    // Native NEAR ↔ wrap.near / wNEAR (same rule as aggregator findOneClickToken)
    if (asset.chain === NEARChain && asset.type === AssetType.NATIVE) {
      return isOneClickNativeNearToken(t)
    }
    if (contract) return t.contractAddress ? t.contractAddress.toLowerCase() === contract.toLowerCase() : false
    return t.symbol.toUpperCase() === asset.symbol.toUpperCase() && !t.contractAddress
  })

  return token?.price !== undefined && token.price > 0 ? token.price : undefined
}
