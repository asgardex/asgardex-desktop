import React, { createContext, useContext } from 'react'

import {
  getAssetsData$,
  getOneClickUsdPrice,
  isOneClickSupportedAsset,
  transactionTrackingService
} from '../services/oneclick'

type OneClickContextValue = {
  transactionTrackingService: typeof transactionTrackingService
  getAssetsData$: typeof getAssetsData$
  isOneClickSupportedAsset: typeof isOneClickSupportedAsset
  getOneClickUsdPrice: typeof getOneClickUsdPrice
}

const initialContext: OneClickContextValue = {
  transactionTrackingService,
  getAssetsData$,
  isOneClickSupportedAsset,
  getOneClickUsdPrice
}

const OneClickContext = createContext<OneClickContextValue | null>(null)

export const OneClickProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <OneClickContext.Provider value={initialContext}>{children}</OneClickContext.Provider>
}

export const useOneClickContext = () => {
  const context = useContext(OneClickContext)
  if (!context) {
    throw new Error('useOneClickContext must be used within a OneClickProvider')
  }
  return context
}
