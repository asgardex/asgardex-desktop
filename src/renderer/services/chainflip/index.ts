import { createChainflipService$ } from './chainflip'

const { getAssetsData$, isAssetSupported$, chainflipSupportedChains$ } = createChainflipService$()

export { getAssetsData$, isAssetSupported$, chainflipSupportedChains$ }
