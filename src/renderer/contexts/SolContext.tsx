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
  subscribeTx,
  resetTx,
  sendTx,
  txRD$,
  reloadFees,
  fees$
} from '../services/solana'

export type SolContextValue = {
  client$: typeof client$
  clientState$: typeof clientState$
  address$: typeof address$
  addressUI$: typeof addressUI$
  explorerUrl$: typeof explorerUrl$
  reloadBalances: typeof reloadBalances
  balances$: typeof balances$
  txs$: typeof txs$
  subscribeTx: typeof subscribeTx
  resetTx: typeof resetTx
  sendTx: typeof sendTx
  txRD$: typeof txRD$
  reloadFees: typeof reloadFees
  fees$: typeof fees$
}

const initialContext: SolContextValue = {
  client$,
  clientState$,
  address$,
  addressUI$,
  explorerUrl$,
  reloadBalances,
  balances$,
  txs$,
  subscribeTx,
  resetTx,
  sendTx,
  txRD$,
  reloadFees,
  fees$
}

const SolContext = createContext<SolContextValue | null>(null)

export const SolProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <SolContext.Provider value={initialContext}>{children}</SolContext.Provider>
}

export const useSolContext = () => {
  const context = useContext(SolContext)
  if (!context) {
    throw new Error('Context must be used within a SolProvider.')
  }
  return context
}
