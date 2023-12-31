import React, { createContext, useContext } from 'react'

import {
  onlineStatus$,
  network$,
  changeNetwork,
  dex$,
  changeDex,
  privateData$,
  changePrivateData,
  clientNetwork$,
  slipTolerance$,
  changeSlipTolerance,
  toggleCollapsedSetting,
  collapsedSettings$
} from '../services/app/service'
import {
  ChangeDexHandler,
  ChangeNetworkHandler,
  ChangeSlipToleranceHandler,
  ToggleCollapsableSetting
} from '../services/app/types'

type AppContextValue = {
  onlineStatus$: typeof onlineStatus$
  network$: typeof network$
  dex$: typeof dex$
  changeDex: ChangeDexHandler
  privateData$: typeof privateData$
  changePrivateData: (value: boolean) => void
  changeNetwork: ChangeNetworkHandler
  clientNetwork$: typeof clientNetwork$
  slipTolerance$: typeof slipTolerance$
  changeSlipTolerance: ChangeSlipToleranceHandler
  collapsedSettings$: typeof collapsedSettings$
  toggleCollapsedSetting: ToggleCollapsableSetting
}
const initialContext: AppContextValue = {
  onlineStatus$,
  network$,
  dex$,
  changeDex,
  privateData$,
  changePrivateData,
  changeNetwork,
  clientNetwork$,
  slipTolerance$,
  changeSlipTolerance,
  collapsedSettings$,
  toggleCollapsedSetting
}

const AppContext = createContext<AppContextValue | null>(null)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => (
  <AppContext.Provider value={initialContext}>{children}</AppContext.Provider>
)

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('Context must be used within a AppProvider.')
  }
  return context
}
