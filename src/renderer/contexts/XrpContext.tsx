import React, { createContext, useContext } from 'react'

import {
  address$,
  addressUI$,
  client$,
  clientState$,
  balances$,
  reloadBalances,
  txs$,
  subscribeTx,
  resetTx,
  sendTx,
  txRD$,
  reloadFees,
  fees$,
  txStatus$
} from '../services/ripple'

export type XrpContextValue = {
  client$: typeof client$
  clientState$: typeof clientState$
  address$: typeof address$
  addressUI$: typeof addressUI$
  balances$: typeof balances$
  reloadBalances: typeof reloadBalances
  txs$: typeof txs$
  subscribeTx: typeof subscribeTx
  resetTx: typeof resetTx
  sendTx: typeof sendTx
  txRD$: typeof txRD$
  reloadFees: typeof reloadFees
  fees$: typeof fees$
  txStatus$: typeof txStatus$
}

const initialContext: XrpContextValue = {
  client$,
  clientState$,
  address$,
  addressUI$,
  balances$,
  reloadBalances,
  txs$,
  subscribeTx,
  resetTx,
  sendTx,
  txRD$,
  reloadFees,
  fees$,
  txStatus$
}

const XrpContext = createContext<XrpContextValue | null>(null)

export const XrpProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <XrpContext.Provider value={initialContext}>{children}</XrpContext.Provider>
}

export const useXrpContext = () => {
  const context = useContext(XrpContext)
  if (!context) {
    throw new Error('Context must be used within a XrpProvider.')
  }
  return context
}
