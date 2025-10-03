import { createChainflipService$ } from './chainflip'

const { getAssetsData$, isAssetSupported$, chainflipSupportedChains$, transactionTrackingService } =
  createChainflipService$()

export { getAssetsData$, isAssetSupported$, chainflipSupportedChains$, transactionTrackingService }
