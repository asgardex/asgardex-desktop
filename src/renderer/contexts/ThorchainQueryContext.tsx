import React, { createContext, useContext, useEffect, useState } from 'react'

import { ThorchainCache, ThorchainQuery, Thornode } from '@xchainjs/xchain-thorchain-query'

import { clientNetwork$ } from '../services/app/service'

// Define the type of the context value here
interface ThorchainQueryContextValue {
  thorchainQuery: ThorchainQuery
}

// Create the context
const ThorchainQueryContext = createContext<ThorchainQueryContextValue | null>(null)

// Provider component
export const ThorchainQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [thorchainQuery, setThorchainQuery] = useState<ThorchainQuery>(new ThorchainQuery())

  useEffect(() => {
    // Subscribe to network$ observable
    const subscription = clientNetwork$.subscribe((network) => {
      // Create a new ThorchainQuery with the updated network
      const thorchainCache = new ThorchainCache(new Thornode(network))
      setThorchainQuery(new ThorchainQuery(thorchainCache))
    })

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe()
  }, [])

  return <ThorchainQueryContext.Provider value={{ thorchainQuery }}>{children}</ThorchainQueryContext.Provider>
}

// Custom hook to use the context
export const useThorchainQueryContext = () => {
  const context = useContext(ThorchainQueryContext)
  if (!context) {
    throw new Error('Context must be used within a ThorchainQueryProvider.')
  }
  return context
}
