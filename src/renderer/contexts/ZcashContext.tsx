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
  reloadFeesWithRates,
  feesWithRates$,
  txStatus$
} from '../services/zcash'

export type ZcashContextValue = {
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
  reloadFeesWithRates: typeof reloadFeesWithRates
  feesWithRates$: typeof feesWithRates$
  txStatus$: typeof txStatus$
}

const initialContext: ZcashContextValue = {
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
  reloadFeesWithRates,
  feesWithRates$,
  txStatus$
}

const ZcashContext = createContext<ZcashContextValue | null>(null)

export const ZcashProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <ZcashContext.Provider value={initialContext}>{children}</ZcashContext.Provider>
}

export const useZcashContext = () => {
  const context = useContext(ZcashContext)
  if (!context) {
    throw new Error('Context must be used within a ZcashProvider.')
  }
  return context
}
