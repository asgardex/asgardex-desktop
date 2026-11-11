import { SwapSDK, AssetData, BoostPoolDepth } from '@chainflip/sdk/swap'
import * as RD from '@devexperts/remote-data-ts'
import {
  AnyAsset,
  Asset,
  CachedValue,
  Chain as XChain,
  SecuredAsset,
  SynthAsset,
  TokenAsset,
  TradeAsset,
  isSecuredAsset,
  isSynthAsset,
  isTradeAsset
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { createScopedLogger } from '../../helpers/logger'
import { triggerStream } from '../../helpers/stateHelper'
import { ChainflipAssetRowData } from './poolData.types'
import { createChainflipTransactionTrackingService } from './transactionTracking'
import {
  cAssetToXAsset,
  cChainToXChain,
  ChainflipVolumeResponse,
  isChainflipSupportedAsset,
  isChainflipSupportedChain,
  sumVolumeByAsset,
  xAssetToCAsset,
  xChainToCChain
} from './utils'

const logger = createScopedLogger('chainflip')

// Create singleton instances to prevent multiple instances and cache invalidation
const sdk = new SwapSDK({
  network: 'mainnet',
  enabledFeatures: {
    dcaV2: true
  }
})
const assetsData = new CachedValue(() => sdk.getAssets(), 24 * 60 * 60 * 1000)
// Boost depths refresh on a shorter cycle since liquidity moves
const boostDepths = new CachedValue<BoostPoolDepth[]>(() => sdk.getBoostLiquidity(), 5 * 60 * 1000)

// Chainflip's swap SDK has no pool volume/liquidity endpoint (it only quotes swaps), so 24h volume is
// read from Chainflip's public reporting API instead — the same undocumented endpoint asgardex.com's
// website uses for its protocol-wide totals. Grouping by both source and destination asset (rather than
// its protocol-wide total) gives genuine per-asset volume, keyed the same as `AssetData.asset`.
const REPORTING_SERVICE_URL = 'https://reporting-service.chainflip.io/graphql'
const VOLUME_24H_QUERY = `
  query Volume24h($since: Datetime!) {
    bySource: allSwapRequests(
      condition: { isInProgress: false }
      filter: { completedBlockTimestamp: { greaterThan: $since } }
    ) {
      groupedAggregates(groupBy: [SOURCE_ASSET]) { keys sum { ingressValueUsd } }
    }
    byDestination: allSwapRequests(
      condition: { isInProgress: false }
      filter: { completedBlockTimestamp: { greaterThan: $since } }
    ) {
      groupedAggregates(groupBy: [DESTINATION_ASSET]) { keys sum { ingressValueUsd } }
    }
  }
`

const fetchChainflipVolume24h = async (): Promise<Map<string, number>> => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const response = await fetch(REPORTING_SERVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: VOLUME_24H_QUERY, variables: { since } })
  })
  if (!response.ok) throw new Error(`Chainflip reporting API error: ${response.status}`)
  const body: ChainflipVolumeResponse = await response.json()
  if (body.errors?.length) throw new Error(`Chainflip reporting API error: ${body.errors[0].message}`)
  return sumVolumeByAsset(body)
}

// 24h volume moves continuously; refresh it on the same cycle as boost depths.
const volume24h = new CachedValue(() => fetchChainflipVolume24h(), 5 * 60 * 1000)

// Create transaction tracking service
const transactionTrackingService = createChainflipTransactionTrackingService(sdk)

export const createChainflipService$ = () => {
  // Latest successfully fetched asset list, converted to XAssets. Kept as a
  // snapshot so `isChainflipSupportedAssetSync` can serve the synchronous swap
  // asset filters and protocol validation.
  let xAssetsSnapshot: ReadonlyArray<AnyAsset> | null = null

  const toXAssets = (assets: AssetData[]): AnyAsset[] =>
    assets.flatMap((asset) => {
      try {
        const xAsset = cAssetToXAsset(asset)
        return xAsset ? [xAsset] : []
      } catch {
        // Chains unknown to XChainJS (e.g. Polkadot) — skip
        return []
      }
    })

  // Observable for cached assets data
  const getAssetsData$ = () =>
    Rx.defer(() => assetsData.getValue()).pipe(
      RxOp.map((assets) => {
        xAssetsSnapshot = toXAssets(assets)
        return RD.success(assets)
      }),
      RxOp.catchError((error) => {
        // Log 429 and other API errors but don't block the swap page
        // Return empty array so THORChain/MAYAChain swaps still work
        logger.warn('Chainflip API error (assets data):', error)
        return Rx.of(RD.success([]))
      }),
      RxOp.shareReplay(1) // Cache the observable result
    )

  /**
   * Synchronous Chainflip support check: exact (full asset identity against
   * the fetched asset list) once it has loaded; chain-level fallback before
   * that or when the API is unavailable. Synth/trade/secured assets are
   * protocol-specific and never route via Chainflip.
   *
   * Replaces the old `isAssetSupported$` Observable, which was misused in
   * sync filter predicates (an Observable is always truthy).
   */
  const isChainflipSupportedAssetSync = (asset: AnyAsset): boolean => {
    if (isSynthAsset(asset) || isTradeAsset(asset) || isSecuredAsset(asset)) return false
    if (xAssetsSnapshot && xAssetsSnapshot.length > 0) return isChainflipSupportedAsset(asset, xAssetsSnapshot)
    return isChainflipSupportedChain(asset.chain)
  }

  // Get supported chains from Chainflip
  const chainflipSupportedChains$ = Rx.defer(() => sdk.getChains()).pipe(
    // Skip chains unknown to ASGARDEX (cChainToXChain returns null for them)
    RxOp.map((chains) => chains.map((chain) => cChainToXChain(chain.chain)).filter((c): c is XChain => c !== null)),
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
      // egressAmount is in USDC smallest units (6 decimals) — use BigNumber
      // to avoid IEEE-754 precision loss for large base-unit integers.
      const usd = new BigNumber(quote.egressAmount).shiftedBy(-6).toNumber()
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
        Promise.all([
          assetsData.getValue(),
          boostDepths.getValue().catch(() => [] as BoostPoolDepth[]),
          volume24h.getValue().catch((error) => {
            logger.warn('Chainflip API error (24h volume):', error)
            return new Map<string, number>()
          })
        ])
      ).pipe(
        RxOp.switchMap(([assets, boost, volumeByAsset]) => {
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
                volume24hUsd: volumeByAsset.get(a.asset),
                boostAvailable: boostByKey.get(`${a.chain}:${a.asset}`) ?? false
              }
              return { row, source: a }
            })
            .filter((r): r is RowPair => r !== null)

          if (rowPairs.length === 0) {
            return Rx.of(RD.success<Error, ChainflipAssetRowData[]>([]))
          }

          const rowKey = (row: Pick<ChainflipAssetRowData, 'chain' | 'symbol'>) => `${row.chain}:${row.symbol}`
          // The asset list (name, icon, min swap, boost) is known as soon as `assets`/`boost` resolve above;
          // show it immediately instead of waiting on every price quote below, so the table isn't blank
          // while prices are still being fetched.
          const initialRows: ChainflipAssetRowData[] = rowPairs.map(({ row }) => ({ ...row, priceUSD: undefined }))

          // Fire per-asset price quotes with limited concurrency (3 at a time) so we don't burst-fire
          // 20+ requests at the Chainflip API on first load. Each resolved price updates its own row and
          // re-emits the full array, rather than buffering everything behind `toArray` until the slowest quote.
          return Rx.from(rowPairs).pipe(
            RxOp.mergeMap(
              ({ row, source }) =>
                Rx.defer(() => getRowPriceUSD(source)).pipe(RxOp.map((priceUSD) => ({ key: rowKey(row), priceUSD }))),
              3
            ),
            RxOp.scan(
              (rows, { key, priceUSD }) => rows.map((r) => (rowKey(r) === key ? { ...r, priceUSD } : r)),
              initialRows
            ),
            RxOp.map((rows) => RD.success<Error, ChainflipAssetRowData[]>(rows)),
            RxOp.startWith(RD.success<Error, ChainflipAssetRowData[]>(initialRows))
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
    isChainflipSupportedAssetSync,
    chainflipSupportedChains$,
    transactionTrackingService,
    getQuotePrice$,
    chainflipAssetRows$,
    reloadChainflipAssetRows
  }
}
