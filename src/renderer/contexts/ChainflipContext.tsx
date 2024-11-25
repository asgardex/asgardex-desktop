import React, { createContext, useContext } from 'react'

import { getAssetsData$, isAssetSupported$, chainflipSupportedChains$, estimateSwap$ } from '../services/chainflip'

export type ChainFlipContextValue = {
  getAssetsData$: typeof getAssetsData$
  isAssetSupported$: typeof isAssetSupported$
  chainflipSupportedChains$: typeof chainflipSupportedChains$
  estimateSwap$: typeof estimateSwap$
}
const initialContext: ChainFlipContextValue = {
  getAssetsData$,
  isAssetSupported$,
  chainflipSupportedChains$,
  estimateSwap$
}

const ChainflipContext = createContext<ChainFlipContextValue | null>(null)
export const ChainflipProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <ChainflipContext.Provider value={initialContext}>{children}</ChainflipContext.Provider>
}

export const useChainflipContext = () => {
  const context = useContext(ChainflipContext)
  if (!context) {
    throw new Error('useChainflip must be used within a ChainflipProvider')
  }
  return context
}
