import React, { createContext, useContext, useEffect, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { ThorchainCache, ThorchainQuery, Thornode } from '@xchainjs/xchain-thorchain-query'

import { LIQUIFY_THORNODE_URLS } from '../helpers/liquifyEndpoints'
import { clientNetwork$, getCurrentNetworkState } from '../services/app/service'

// Prefer the Liquify gateway over the public THORNode for mainnet quotes — the
// xchainjs default lists `thornode.thorchain.network` first and only falls back
// to Liquify. Keeps the same "Liquify primary" behaviour as the swap aggregator
// (see helpers/liquifyEndpoints). Other networks keep the library defaults
// (stagenet has no URLs, testnet is deprecated).
const createThornode = (network: Network): Thornode =>
  network === Network.Mainnet
    ? new Thornode(network, { apiRetries: 3, thornodeBaseUrls: LIQUIFY_THORNODE_URLS })
    : new Thornode(network)

// Define the type of the context value here
interface ThorchainQueryContextValue {
  thorchainQuery: ThorchainQuery
}

// Create the context
const ThorchainQueryContext = createContext<ThorchainQueryContextValue | null>(null)

// Provider component
export const ThorchainQueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [thorchainQuery, setThorchainQuery] = useState<ThorchainQuery>(
    () => new ThorchainQuery(new ThorchainCache(createThornode(getCurrentNetworkState())))
  )

  useEffect(() => {
    // Subscribe to network$ observable
    const subscription = clientNetwork$.subscribe((network) => {
      // Create a new ThorchainQuery with the updated network
      const thorchainCache = new ThorchainCache(createThornode(network))
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
