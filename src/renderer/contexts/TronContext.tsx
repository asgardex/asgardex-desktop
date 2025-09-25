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
  subscribeTx,
  resetTx,
  sendTx,
  txs$,
  tx$,
  txStatus$,
  explorerUrl$,
  approveTRC20Token$,
  isApprovedTRC20Token$
} from '../services/tron'

type TronContextValue = {
  client$: typeof client$
  clientState$: typeof clientState$
  address$: typeof address$
  addressUI$: typeof addressUI$
  reloadBalances: typeof reloadBalances
  balances$: typeof balances$
  getBalanceByAddress$: typeof getBalanceByAddress$
  reloadFees: typeof reloadFees
  fees$: typeof fees$
  txRD$: typeof txRD$
  subscribeTx: typeof subscribeTx
  resetTx: typeof resetTx
  sendTx: typeof sendTx
  txs$: typeof txs$
  tx$: typeof tx$
  txStatus$: typeof txStatus$
  explorerUrl$: typeof explorerUrl$
  approveTRC20Token$: typeof approveTRC20Token$
  isApprovedTRC20Token$: typeof isApprovedTRC20Token$
}

const initialContext: TronContextValue = {
  client$,
  clientState$,
  address$,
  addressUI$,
  reloadBalances,
  balances$,
  getBalanceByAddress$,
  reloadFees,
  fees$,
  txRD$,
  subscribeTx,
  resetTx,
  sendTx,
  txs$,
  tx$,
  txStatus$,
  explorerUrl$,
  approveTRC20Token$,
  isApprovedTRC20Token$
}

const TronContext = createContext<TronContextValue | null>(null)

export const TronProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <TronContext.Provider value={initialContext}>{children}</TronContext.Provider>
}

export const useTronContext = () => {
  const context = useContext(TronContext)
  if (!context) {
    throw new Error('Context must be used within a TronProvider.')
  }
  return context
}
