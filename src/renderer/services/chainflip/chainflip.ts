import { SwapSDK, AssetData } from '@chainflip/sdk/swap'
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
import { createChainflipTransactionTrackingService } from './transactionTracking'
import { cChainToXChain, xAssetToCAsset, xChainToCChain } from './utils'

const logger = createScopedLogger('chainflip')

// Create singleton instances to prevent multiple instances and cache invalidation
const sdk = new SwapSDK({
  network: 'mainnet',
  enabledFeatures: {
    dca: true
  }
})
const assetsData = new CachedValue(() => sdk.getAssets(), 24 * 60 * 60 * 1000)

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
   */
  const getQuotePrice$ = (asset: AnyAsset) => {
    if (isSynthAsset(asset) || isTradeAsset(asset) || isSecuredAsset(asset)) {
      return Rx.of(RD.initial as RD.RemoteData<Error, number>)
    }

    // After filtering out synth/trade/secured, the asset is Asset | TokenAsset
    const narrowedAsset = asset as Asset | TokenAsset

    return Rx.defer(async () => {
      const srcChain = xChainToCChain(narrowedAsset.chain) as Exclude<ReturnType<typeof xChainToCChain>, 'Polkadot'>
      const srcAsset = xAssetToCAsset(narrowedAsset)

      // Native asset decimals for Chainflip-supported chains
      const DECIMALS: Record<string, number> = { BTC: 8, ETH: 18, SOL: 9 }
      const decimals = DECIMALS[srcAsset] ?? 18
      const amount = Math.pow(10, decimals).toString()

      const response = await sdk.getQuoteV2({
        srcChain,
        srcAsset,
        destChain: 'Ethereum',
        destAsset: 'USDC',
        amount
      })

      const quote = response.quotes[0]
      if (!quote) throw new Error('No quote available')

      // egressAmount is in USDC smallest units (6 decimals)
      const usdPrice = Number(quote.egressAmount) / 1e6
      if (isNaN(usdPrice) || usdPrice <= 0) throw new Error('Invalid price from quote')

      return usdPrice
    }).pipe(
      RxOp.map((price) => RD.success<Error, number>(price)),
      RxOp.catchError((error) => {
        logger.warn('Chainflip quote price error:', error)
        return Rx.of(RD.failure<Error, number>(error instanceof Error ? error : new Error(String(error))))
      }),
      RxOp.shareReplay(1)
    )
  }

  return {
    getAssetsData$,
    isAssetSupported$,
    chainflipSupportedChains$,
    transactionTrackingService,
    getQuotePrice$
  }
}
