import { createChainflipService$ } from './chainflip'

const { getAssetsData$, isAssetSupported$, chainflipSupportedChains$, transactionTrackingService, getQuotePrice$ } =
  createChainflipService$()

export { getAssetsData$, isAssetSupported$, chainflipSupportedChains$, transactionTrackingService, getQuotePrice$ }
