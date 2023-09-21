import React, { createContext, useContext } from 'react'

import { ThorchainQuery } from '@xchainjs/xchain-thorchain-query'

// Define the type of the context value here
interface ThorchainQueryContextValue {
  thorchainQuery: ThorchainQuery
}

// Create an initial context value
const initialContext: ThorchainQueryContextValue = { thorchainQuery: new ThorchainQuery() }

// Create the context
const ThorchainQueryContext = createContext<ThorchainQueryContextValue | null>(null)

// Provider component
export const ThorchainQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <ThorchainQueryContext.Provider value={initialContext}>{children}</ThorchainQueryContext.Provider>
}

// Custom hook to use the context
export const useThorchainQueryContext = () => {
  const context = useContext(ThorchainQueryContext)
  if (!context) {
    throw new Error('Context must be used within a ThorchainQueryProvider.')
  }
  return context
}
