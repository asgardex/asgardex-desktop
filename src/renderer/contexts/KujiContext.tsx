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
} from '../services/kuji'

export type KujiContextValue = {
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

const initialContext: KujiContextValue = {
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

const KujiContext = createContext<KujiContextValue | null>(null)

export const KujiProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <KujiContext.Provider value={initialContext}>{children}</KujiContext.Provider>
}

export const useKujiContext = () => {
  const context = useContext(KujiContext)
  if (!context) {
    throw new Error('Context must be used within a KujiProvider.')
  }
  return context
}
