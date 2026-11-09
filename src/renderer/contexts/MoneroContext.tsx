import React, { createContext, useContext } from 'react'

import {
  client$,
  clientState$,
  address$,
  addressUI$,
  explorerUrl$,
  reloadBalances,
  balances$,
  txs$,
  reloadFees,
  fees$
} from '../services/monero'

/**
 * Monero context: **watch-only** — no `sendTx` / `subscribeTx` on purpose.
 */
type MoneroContextValue = {
  client$: typeof client$
  clientState$: typeof clientState$
  address$: typeof address$
  addressUI$: typeof addressUI$
  explorerUrl$: typeof explorerUrl$
  reloadBalances: typeof reloadBalances
  balances$: typeof balances$
  txs$: typeof txs$
  reloadFees: typeof reloadFees
  fees$: typeof fees$
}

const initialContext: MoneroContextValue = {
  client$,
  clientState$,
  address$,
  addressUI$,
  explorerUrl$,
  reloadBalances,
  balances$,
  txs$,
  reloadFees,
  fees$
}

const MoneroContext = createContext<MoneroContextValue | null>(null)

export const MoneroProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <MoneroContext.Provider value={initialContext}>{children}</MoneroContext.Provider>
}

export const useMoneroContext = () => {
  const context = useContext(MoneroContext)
  if (!context) {
    throw new Error('Context must be used within a MoneroProvider.')
  }
  return context
}
