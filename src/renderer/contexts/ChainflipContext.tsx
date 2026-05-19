import React, { createContext, useContext } from 'react'

import {
  getAssetsData$,
  isAssetSupported$,
  chainflipSupportedChains$,
  transactionTrackingService,
  getQuotePrice$,
  chainflipAssetRows$,
  reloadChainflipAssetRows
} from '../services/chainflip'

type ChainFlipContextValue = {
  getAssetsData$: typeof getAssetsData$
  isAssetSupported$: typeof isAssetSupported$
  chainflipSupportedChains$: typeof chainflipSupportedChains$
  transactionTrackingService: typeof transactionTrackingService
  getQuotePrice$: typeof getQuotePrice$
  chainflipAssetRows$: typeof chainflipAssetRows$
  reloadChainflipAssetRows: typeof reloadChainflipAssetRows
}
const initialContext: ChainFlipContextValue = {
  getAssetsData$,
  isAssetSupported$,
  chainflipSupportedChains$,
  transactionTrackingService,
  getQuotePrice$,
  chainflipAssetRows$,
  reloadChainflipAssetRows
}

const ChainflipContext = createContext<ChainFlipContextValue | null>(null)
export const ChainflipProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <ChainflipContext.Provider value={initialContext}>{children}</ChainflipContext.Provider>
}

export const useChainflipContext = () => {
  const context = useContext(ChainflipContext)
  if (!context) {
    throw new Error('useChainflip must be used within a ChainflipProvider')
  }
  return context
}
