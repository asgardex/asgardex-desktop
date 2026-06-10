import React, { createContext, useContext } from 'react'

import { transactionTrackingService } from '../services/oneclick'

type OneClickContextValue = {
  transactionTrackingService: typeof transactionTrackingService
}

const initialContext: OneClickContextValue = {
  transactionTrackingService
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
