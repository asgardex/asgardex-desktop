import { SwapSDK, AssetData } from '@chainflip/sdk/swap'
import * as RD from '@devexperts/remote-data-ts'
import { QuoteSwapParams } from '@xchainjs/xchain-thorchain-query'
import {
  AnyAsset,
  Asset,
  CachedValue,
  CryptoAmount,
  SynthAsset,
  TokenAsset,
  TradeAsset,
  baseAmount,
  isSynthAsset,
  isTradeAsset
} from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { cChainToXChain, xAssetToCAsset } from './utils'

export const createChainflipService$ = () => {
  // Initialize SDK instance
  const sdk = new SwapSDK({ network: 'mainnet' })

  // Cached asset data, refreshed every 24 hours
  const assetsData = new CachedValue(() => sdk.getAssets(), 24 * 60 * 60 * 1000)

  // Observable for cached assets data
  const getAssetsData$ = () =>
    Rx.defer(() => assetsData.getValue()).pipe(
      RxOp.map((assets) => RD.success(assets)),
      RxOp.catchError((e) => Rx.of(RD.failure(e))),
      RxOp.shareReplay(1) // Cache the observable result
    )

  // Check if an asset is supported in Chainflip
  const isAssetSupported$ = (asset: AnyAsset) => {
    if (isSynthAsset(asset) || isTradeAsset(asset)) return Rx.of(false)
    return Rx.defer(() => getAssetData(asset)).pipe(
      RxOp.map(() => true),
      RxOp.catchError(() => Rx.of(false))
    )
  }

  // Get supported chains from Chainflip
  const chainflipSupportedChains$ = Rx.defer(() => sdk.getChains()).pipe(
    RxOp.map((chains) => chains.map((chain) => cChainToXChain(chain.chain))),
    RxOp.map((chains) => RD.success(chains)),
    RxOp.catchError((e) => Rx.of(RD.failure(e)))
  )

  // Estimate swap
  const estimateSwap$ = (params: QuoteSwapParams) =>
    Rx.defer(async () => {
      const srcAssetData = await getAssetData(params.fromAsset)
      const destAssetData = await getAssetData(params.destinationAsset)

      const { quote } = await sdk.getQuote({
        srcChain: srcAssetData.chain,
        srcAsset: srcAssetData.asset,
        destChain: destAssetData.chain,
        destAsset: destAssetData.asset,
        amount: params.amount.baseAmount.amount().toString()
      })

      const outboundFee = quote.includedFees.find((fee) => fee.type === 'EGRESS')
      const brokerFee = quote.includedFees.find((fee) => fee.type === 'BROKER')

      return RD.success({
        protocol: 'Chainflip',
        expectedAmount: new CryptoAmount(
          baseAmount(quote.egressAmount, destAssetData.decimals),
          params.destinationAsset
        ),
        dustThreshold: new CryptoAmount(
          baseAmount(srcAssetData.minimumSwapAmount, srcAssetData.decimals),
          params.fromAsset
        ),
        fees: {
          outboundFee: new CryptoAmount(
            baseAmount(outboundFee?.amount || 0, destAssetData.decimals),
            params.destinationAsset
          ),
          affiliateFee: new CryptoAmount(
            baseAmount(brokerFee?.amount || 0, destAssetData.decimals),
            params.destinationAsset
          )
        }
      })
    }).pipe(RxOp.catchError((e) => Rx.of(RD.failure(e))))

  // Helper to fetch specific asset data
  const getAssetData = async (asset: Asset | TokenAsset | SynthAsset | TradeAsset): Promise<AssetData> => {
    if (isSynthAsset(asset) || isTradeAsset(asset)) {
      throw new Error('Synth and Trade assets are not supported in Chainflip protocol')
    }
    const chainAssets = await assetsData.getValue()
    const assetData = chainAssets.find(
      (chainAsset) => chainAsset.asset === xAssetToCAsset(asset) && asset.chain === cChainToXChain(chainAsset.chain)
    )
    if (!assetData) throw new Error(`${asset.ticker} asset not supported in ${asset.chain} chain`)
    return assetData
  }

  return {
    getAssetsData$,
    isAssetSupported$,
    chainflipSupportedChains$,
    estimateSwap$
  }
}
