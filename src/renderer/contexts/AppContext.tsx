import React, { createContext, useContext } from 'react'

import {
  onlineStatus$,
  network$,
  changeNetwork,
  privateData$,
  changePrivateData,
  clientNetwork$,
  streamingSlipTolerance$,
  changeStreamingSlipTolerance,
  tradeSlipTolerance$,
  changeTradeSlipTolerance,
  toggleCollapsedSetting,
  collapsedSettings$
} from '../services/app/service'
import { ChangeNetworkHandler, ChangeSlipToleranceHandler, ToggleCollapsableSetting } from '../services/app/types'

type AppContextValue = {
  onlineStatus$: typeof onlineStatus$
  network$: typeof network$
  privateData$: typeof privateData$
  changePrivateData: (value: boolean) => void
  changeNetwork: ChangeNetworkHandler
  clientNetwork$: typeof clientNetwork$
  streamingSlipTolerance$: typeof streamingSlipTolerance$
  changeStreamingSlipTolerance: ChangeSlipToleranceHandler
  tradeSlipTolerance$: typeof tradeSlipTolerance$
  changeTradeSlipTolerance: ChangeSlipToleranceHandler
  collapsedSettings$: typeof collapsedSettings$
  toggleCollapsedSetting: ToggleCollapsableSetting
}
const initialContext: AppContextValue = {
  onlineStatus$,
  network$,
  privateData$,
  changePrivateData,
  changeNetwork,
  clientNetwork$,
  streamingSlipTolerance$,
  changeStreamingSlipTolerance,
  tradeSlipTolerance$,
  changeTradeSlipTolerance,
  collapsedSettings$,
  toggleCollapsedSetting
}

const AppContext = createContext<AppContextValue | null>(null)

export const AppProvider = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <AppContext.Provider value={initialContext}>{children}</AppContext.Provider>
)

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('Context must be used within a AppProvider.')
  }
  return context
}
