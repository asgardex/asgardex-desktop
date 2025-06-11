import React, { createContext, useContext, useEffect, useState } from 'react'

import { MayachainCache, MayachainQuery } from '@xchainjs/xchain-mayachain-query'

import { clientNetwork$ } from '../services/app/service'

// Define the type of the context value here
interface MayachainQueryContextValue {
  mayachainQuery: MayachainQuery
}

// Create the context
const MayachainQueryContext = createContext<MayachainQueryContextValue | null>(null)

// Provider component
export const MayachainQueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [mayachainQuery, setMayachainQuery] = useState<MayachainQuery>(new MayachainQuery())

  useEffect(() => {
    // Subscribe to network$ observable
    const subscription = clientNetwork$.subscribe(() => {
      // Create a new MayachainQuery with the updated network
      const mayachainCache = new MayachainCache()
      setMayachainQuery(new MayachainQuery(mayachainCache))
    })

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe()
  }, [])

  return <MayachainQueryContext.Provider value={{ mayachainQuery }}>{children}</MayachainQueryContext.Provider>
}

// Custom hook to use the context
export const useMayachainQueryContext = () => {
  const context = useContext(MayachainQueryContext)
  if (!context) {
    throw new Error('Context must be used within a MayachainQueryProvider.')
  }
  return context
}
