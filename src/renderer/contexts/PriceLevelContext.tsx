import React, { createContext, useContext, useEffect, useMemo } from 'react'

import { createPriceLevelService, type PriceLevelService } from '../services/priceLevel'
import { useMidgardContext } from './MidgardContext'

const PriceLevelContext = createContext<PriceLevelService | null>(null)

export const PriceLevelProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const {
    service: {
      pools: { apiGetDepthHistory$ }
    }
  } = useMidgardContext()

  const service = useMemo(() => createPriceLevelService(apiGetDepthHistory$), [apiGetDepthHistory$])

  useEffect(() => {
    return () => service.dispose()
  }, [service])

  return <PriceLevelContext.Provider value={service}>{children}</PriceLevelContext.Provider>
}

export const usePriceLevelContext = (): PriceLevelService => {
  const context = useContext(PriceLevelContext)
  if (!context) {
    throw new Error('usePriceLevelContext must be used within a PriceLevelProvider')
  }
  return context
}
