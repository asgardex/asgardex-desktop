import { SwapSDK, AssetData, BoostPoolDepth } from '@chainflip/sdk/swap'
import * as RD from '@devexperts/remote-data-ts'
import {
  AnyAsset,
  Asset,
  CachedValue,
  SecuredAsset,
  SynthAsset,
  TokenAsset,
  TradeAsset,
  isSecuredAsset,
  isSynthAsset,
  isTradeAsset
} from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { createScopedLogger } from '../../helpers/logger'
import { triggerStream } from '../../helpers/stateHelper'
import { ChainflipAssetRowData } from './poolData.types'
import { createChainflipTransactionTrackingService } from './transactionTracking'
import { cAssetToXAsset, cChainToXChain, xAssetToCAsset, xChainToCChain } from './utils'

const logger = createScopedLogger('chainflip')

// Create singleton instances to prevent multiple instances and cache invalidation
const sdk = new SwapSDK({
  network: 'mainnet',
  enabledFeatures: {
    dca: true
  }
})
const assetsData = new CachedValue(() => sdk.getAssets(), 24 * 60 * 60 * 1000)
// Boost depths refresh on a shorter cycle since liquidity moves
const boostDepths = new CachedValue<BoostPoolDepth[]>(() => sdk.getBoostLiquidity(), 5 * 60 * 1000)

// Create transaction tracking service
const transactionTrackingService = createChainflipTransactionTrackingService(sdk)

export const createChainflipService$ = () => {
  // Observable for cached assets data
  const getAssetsData$ = () =>
    Rx.defer(() => assetsData.getValue()).pipe(
      RxOp.map((assets) => RD.success(assets)),
      RxOp.catchError((error) => {
        // Log 429 and other API errors but don't block the swap page
        // Return empty array so THORChain/MAYAChain swaps still work
        logger.warn('Chainflip API error (assets data):', error)
        return Rx.of(RD.success([]))
      }),
      RxOp.shareReplay(1) // Cache the observable result
    )

  // Check if an asset is supported in Chainflip
  const isAssetSupported$ = (asset: AnyAsset) => {
    if (isSynthAsset(asset) || isTradeAsset(asset) || isSecuredAsset(asset)) return Rx.of(false)
    return Rx.defer(() => getAssetData(asset)).pipe(
      RxOp.map(() => true),
      RxOp.catchError((error) => {
        // Handle specific error messages from Chainflip SDK
        if (error.message && error.message.includes('disabled')) {
          logger.warn('Asset %s is disabled in Chainflip:', asset.ticker, error.message)
        }
        return Rx.of(false)
      }),
      RxOp.shareReplay(1) // Prevent duplicate requests for the same asset
    )
  }

  // Get supported chains from Chainflip
  const chainflipSupportedChains$ = Rx.defer(() => sdk.getChains()).pipe(
    RxOp.map((chains) => chains.map((chain) => cChainToXChain(chain.chain))),
    RxOp.map((chains) => RD.success(chains)),
    RxOp.catchError((error) => {
      // Log 429 and other API errors but don't block the UI
      // Return empty array so other protocols still work
      logger.warn('Chainflip API error (supported chains):', error)
      return Rx.of(RD.success([]))
    }),
    RxOp.shareReplay(1) // Prevent duplicate chain requests
  )

  // Helper to fetch specific asset data
  const getAssetData = async (
    asset: Asset | TokenAsset | SynthAsset | TradeAsset | SecuredAsset
  ): Promise<AssetData> => {
    if (isSynthAsset(asset) || isTradeAsset(asset) || isSecuredAsset(asset)) {
      throw new Error('Synth and Trade assets are not supported in Chainflip protocol')
    }
    try {
      const chainAssets = await assetsData.getValue()
      const assetData = chainAssets.find(
        (chainAsset) => chainAsset.asset === xAssetToCAsset(asset) && asset.chain === cChainToXChain(chainAsset.chain)
      )
      if (!assetData) throw new Error(`${asset.ticker} asset not supported in ${asset.chain} chain`)
      return assetData
    } catch (error) {
      // Handle 429 rate limit and other API errors gracefully
      // Log the error but don't crash the app
      logger.warn('Chainflip API error (asset data fetch):', error)

      // Handle specific "disabled" error messages from Chainflip SDK
      if (error instanceof Error && error.message && error.message.toLowerCase().includes('disabled')) {
        throw new Error(`Asset ${asset.ticker} is currently disabled in Chainflip protocol`)
      }

      throw new Error(`Chainflip service temporarily unavailable for ${asset.ticker}`)
    }
  }

  /**
   * Get a USD spot price for an asset by quoting 1 unit against USDC on Ethereum.
   * Returns RD.initial for unsupported assets/chains.
   *
   * Resolves the asset's AssetData from the cache (real decimals + stablecoin
   * detection live in getRowPriceUSD) so token pools (USDC/USDT/WBTC/…) work
   * correctly instead of falling back to a wrong 18-decimal guess.
   */
  const getQuotePrice$ = (asset: AnyAsset) => {
    if (isSynthAsset(asset) || isTradeAsset(asset) || isSecuredAsset(asset)) {
      return Rx.of(RD.initial as RD.RemoteData<Error, number>)
    }

    // After filtering out synth/trade/secured, the asset is Asset | TokenAsset
    const narrowedAsset = asset as Asset | TokenAsset

    return Rx.defer(async () => {
      const assetData = await getAssetData(narrowedAsset)
      const price = await getRowPriceUSD(assetData)
      if (price === undefined) throw new Error('No price available')
      return price
    }).pipe(
      RxOp.map((price) => RD.success<Error, number>(price)),
      RxOp.catchError((error) => {
        logger.warn('Chainflip quote price error:', error)
        return Rx.of(RD.failure<Error, number>(error instanceof Error ? error : new Error(String(error))))
      }),
      RxOp.shareReplay(1)
    )
  }

  // Known stablecoins on Chainflip — treat as ~$1 instead of round-tripping a quote to USDC
  // (USDC→USDC would fail; USDT→USDC depends on routing and adds noise to the table)
  const STABLECOIN_SYMBOLS = new Set(['USDC', 'USDT', 'DAI'])

  /**
   * USD price fetch shared by chainflipAssetRows$ and getQuotePrice$.
   * Reads the asset's real decimals from AssetData and short-circuits
   * stablecoins to $1 (USDC→USDC would fail; USDT→USDC adds routing noise).
   */
  const getRowPriceUSD = async (a: AssetData): Promise<number | undefined> => {
    if (STABLECOIN_SYMBOLS.has(a.symbol)) return 1.0
    try {
      const amount = Math.pow(10, a.decimals).toString()
      const response = await sdk.getQuoteV2({
        srcChain: a.chain as Exclude<ReturnType<typeof xChainToCChain>, 'Polkadot'>,
        srcAsset: a.asset,
        destChain: 'Ethereum',
        destAsset: 'USDC',
        amount
      })
      const quote = response.quotes[0]
      if (!quote) return undefined
      // egressAmount is in USDC smallest units (6 decimals)
      const usd = Number(quote.egressAmount) / 1e6
      return isFinite(usd) && usd > 0 ? usd : undefined
    } catch (error) {
      logger.warn(`Chainflip row price error for ${a.symbol} on ${a.chain}:`, error)
      return undefined
    }
  }

  // Manual refresh trigger for the asset-rows view. Re-fires the full pipeline
  // (re-quotes prices; boostDepths/assetsData honor their own TTL caches).
  const { stream$: reloadAssetRows$, trigger: reloadChainflipAssetRows } = triggerStream()

  /**
   * Combined observable of all Chainflip-supported assets with price (USDC quote) and boost availability.
   * Used by the pools view to render Chainflip swap pairs.
   * Skips assets whose chain doesn't map to an xchainjs Chain (e.g. Assethub — no client/support).
   */
  const chainflipAssetRows$: Rx.Observable<RD.RemoteData<Error, ChainflipAssetRowData[]>> = reloadAssetRows$.pipe(
    RxOp.switchMap(() =>
      Rx.defer(() =>
        Promise.all([assetsData.getValue(), boostDepths.getValue().catch(() => [] as BoostPoolDepth[])])
      ).pipe(
        RxOp.switchMap(([assets, boost]) => {
          // Bucket boost depths by asset+chain
          const boostByKey = new Map<string, boolean>()
          for (const bd of boost) {
            if (bd.availableAmount > BigInt(0)) boostByKey.set(`${bd.chain}:${bd.asset}`, true)
          }

          type RowPair = { row: Omit<ChainflipAssetRowData, 'priceUSD'>; source: AssetData }
          const rowPairs: RowPair[] = assets
            .map((a): RowPair | null => {
              const xAsset = cAssetToXAsset(a)
              const xChain = cChainToXChain(a.chain)
              if (!xAsset || !xChain) return null
              const row: Omit<ChainflipAssetRowData, 'priceUSD'> = {
                asset: xAsset,
                chain: xChain,
                name: a.name,
                symbol: a.symbol,
                decimals: a.decimals,
                minSwapAmount: a.minimumSwapAmount,
                maxSwapAmount: a.maximumSwapAmount,
                boostAvailable: boostByKey.get(`${a.chain}:${a.asset}`) ?? false
              }
              return { row, source: a }
            })
            .filter((r): r is RowPair => r !== null)

          if (rowPairs.length === 0) {
            return Rx.of(RD.success<Error, ChainflipAssetRowData[]>([]))
          }

          // Fire per-asset price quotes with limited concurrency (3 at a time)
          // so we don't burst-fire 20+ requests at the Chainflip API on first load.
          return Rx.from(rowPairs).pipe(
            RxOp.mergeMap(
              ({ row, source }) =>
                Rx.defer(() => getRowPriceUSD(source)).pipe(RxOp.map((priceUSD) => ({ ...row, priceUSD }))),
              3
            ),
            RxOp.toArray(),
            RxOp.map((withPrices) => RD.success<Error, ChainflipAssetRowData[]>(withPrices))
          )
        }),
        RxOp.catchError((error) => {
          logger.warn('Chainflip API error (asset rows):', error)
          return Rx.of(
            RD.failure<Error, ChainflipAssetRowData[]>(error instanceof Error ? error : new Error(String(error)))
          )
        }),
        RxOp.startWith(RD.pending as RD.RemoteData<Error, ChainflipAssetRowData[]>)
      )
    ),
    RxOp.shareReplay(1)
  )

  return {
    getAssetsData$,
    isAssetSupported$,
    chainflipSupportedChains$,
    transactionTrackingService,
    getQuotePrice$,
    chainflipAssetRows$,
    reloadChainflipAssetRows
  }
}
