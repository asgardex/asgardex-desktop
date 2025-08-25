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

import { cChainToXChain, xAssetToCAsset } from './utils'

// Create singleton instances to prevent multiple instances and cache invalidation
const sdk = new SwapSDK({ network: 'mainnet' })
const assetsData = new CachedValue(() => sdk.getAssets(), 24 * 60 * 60 * 1000)

export const createChainflipService$ = () => {
  // Observable for cached assets data
  const getAssetsData$ = () =>
    Rx.defer(() => assetsData.getValue()).pipe(
      RxOp.map((assets) => RD.success(assets)),
      RxOp.catchError((error) => {
        // Log 429 and other API errors but don't crash the UI
        console.warn('Chainflip API error (assets data):', error)
        return Rx.of(RD.failure(new Error('Chainflip service temporarily unavailable')))
      }),
      RxOp.shareReplay(1) // Cache the observable result
    )

  // Check if an asset is supported in Chainflip
  const isAssetSupported$ = (asset: AnyAsset) => {
    if (isSynthAsset(asset) || isTradeAsset(asset) || isSecuredAsset(asset)) return Rx.of(false)
    return Rx.defer(() => getAssetData(asset)).pipe(
      RxOp.map(() => true),
      RxOp.catchError(() => Rx.of(false)),
      RxOp.shareReplay(1) // Prevent duplicate requests for the same asset
    )
  }

  // Get supported chains from Chainflip
  const chainflipSupportedChains$ = Rx.defer(() => sdk.getChains()).pipe(
    RxOp.map((chains) => chains.map((chain) => cChainToXChain(chain.chain))),
    RxOp.map((chains) => RD.success(chains)),
    RxOp.catchError((error) => {
      // Log 429 and other API errors but don't crash the UI
      console.warn('Chainflip API error (supported chains):', error)
      return Rx.of(RD.failure(new Error('Chainflip service temporarily unavailable')))
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
      console.warn('Chainflip API error (asset data fetch):', error)
      throw new Error(`Chainflip service temporarily unavailable for ${asset.ticker}`)
    }
  }

  return {
    getAssetsData$,
    isAssetSupported$,
    chainflipSupportedChains$
  }
}
