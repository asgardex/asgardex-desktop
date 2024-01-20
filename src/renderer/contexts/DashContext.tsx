import React, { createContext, useContext } from 'react'

import {
  client$,
  clientState$,
  address$,
  addressUI$,
  reloadBalances,
  balances$,
  getBalanceByAddress$,
  txRD$,
  reloadFees,
  fees$,
  feesWithRates$,
  reloadFeesWithRates,
  subscribeTx,
  resetTx,
  explorerUrl$
} from '../services/dash'

export type DashContextValue = {
  client$: typeof client$
  clientState$: typeof clientState$
  address$: typeof address$
  addressUI$: typeof addressUI$
  reloadBalances: typeof reloadBalances
  balances$: typeof balances$
  getBalanceByAddress$: typeof getBalanceByAddress$
  reloadFees: typeof reloadFees
  fees$: typeof fees$
  reloadFeesWithRates: typeof reloadFeesWithRates
  feesWithRates$: typeof feesWithRates$
  txRD$: typeof txRD$
  subscribeTx: typeof subscribeTx
  resetTx: typeof resetTx
  explorerUrl$: typeof explorerUrl$
}

const initialContext: DashContextValue = {
  client$,
  clientState$,
  address$,
  addressUI$,
  reloadBalances,
  balances$,
  getBalanceByAddress$,
  reloadFees,
  fees$,
  reloadFeesWithRates,
  feesWithRates$,
  txRD$,
  subscribeTx,
  resetTx,
  explorerUrl$
}

const DashContext = createContext<DashContextValue | null>(null)

export const DashProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <DashContext.Provider value={initialContext}>{children}</DashContext.Provider>
}

export const useDashContext = () => {
  const context = useContext(DashContext)
  if (!context) {
    throw new Error('Context must be used within a DashProvider.')
  }
  return context
}
