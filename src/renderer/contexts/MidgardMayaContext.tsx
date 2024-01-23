import React, { createContext, useContext } from 'react'

import { service } from '../services/mayaMigard/service'
import { pools as poolsStorage } from '../services/storage'

type MidgardContextValue = {
  service: typeof service
  storage: { pools: typeof poolsStorage }
}

const initialContext: MidgardContextValue = {
  service,
  storage: { pools: poolsStorage }
}
const MidgardMayaContext = createContext<MidgardContextValue | null>(null)

export const MayaMidgardProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <MidgardMayaContext.Provider value={initialContext}>{children}</MidgardMayaContext.Provider>
}

export const useMidgardMayaContext = () => {
  const context = useContext(MidgardMayaContext)
  if (!context) {
    throw new Error('Context must be used within a MidgardProvider.')
  }
  return context
}
