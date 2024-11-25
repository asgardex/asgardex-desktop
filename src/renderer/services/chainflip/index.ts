import { createChainflipService$ } from './chainflip'

const { getAssetsData$, isAssetSupported$, chainflipSupportedChains$, estimateSwap$ } = createChainflipService$()

export { getAssetsData$, isAssetSupported$, chainflipSupportedChains$, estimateSwap$ }
