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
} from '../services/radix'

export type XrdContextValue = {
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

const initialContext: XrdContextValue = {
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

const XrdContext = createContext<XrdContextValue | null>(null)

export const XrdProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <XrdContext.Provider value={initialContext}>{children}</XrdContext.Provider>
}

export const useXrdContext = () => {
  const context = useContext(XrdContext)
  if (!context) {
    throw new Error('Context must be used within a XrdProvider.')
  }
  return context
}
