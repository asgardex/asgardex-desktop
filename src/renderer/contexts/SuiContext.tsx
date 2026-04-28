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
} from '../services/sui'

type SuiContextValue = {
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

const initialContext: SuiContextValue = {
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

const SuiContext = createContext<SuiContextValue | null>(null)

export const SuiProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <SuiContext.Provider value={initialContext}>{children}</SuiContext.Provider>
}

export const useSuiContext = () => {
  const context = useContext(SuiContext)
  if (!context) {
    throw new Error('Context must be used within a SuiProvider.')
  }
  return context
}
