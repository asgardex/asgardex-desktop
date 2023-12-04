import React, { createContext, useContext } from 'react'

import {
  client$,
  clientState$,
  clientUrl$,
  setMayanodeRpcUrl,
  setMayanodeApiUrl,
  address$,
  addressUI$,
  balances$,
  reloadBalances,
  txs$,
  reloadFees,
  fees$,
  txRD$,
  sendTx,
  resetTx,
  subscribeTx,
  interact$,
  getNodeInfos$,
  reloadNodeInfos,
  explorerUrl$,
  mimir$,
  reloadMimir,
  inboundAddressesShared$,
  reloadInboundAddresses,
  reloadMayachainConstants,
  mayachainConstantsState$,
  mayachainLastblockState$,
  reloadMayachainLastblock,
  getLiquidityProviders,
  reloadLiquidityProviders
} from '../services/mayachain'

export type MayachainContextValue = {
  client$: typeof client$
  clientState$: typeof clientState$
  clientUrl$: typeof clientUrl$
  setMayanodeRpcUrl: typeof setMayanodeRpcUrl
  setMayanodeApiUrl: typeof setMayanodeApiUrl
  address$: typeof address$
  addressUI$: typeof addressUI$
  reloadBalances: typeof reloadBalances
  balances$: typeof balances$
  txs$: typeof txs$
  reloadFees: typeof reloadFees
  fees$: typeof fees$
  subscribeTx: typeof subscribeTx
  resetTx: typeof resetTx
  sendTx: typeof sendTx
  txRD$: typeof txRD$
  interact$: typeof interact$
  getNodeInfos$: typeof getNodeInfos$
  explorerUrl$: typeof explorerUrl$
  reloadNodeInfos: typeof reloadNodeInfos
  mimir$: typeof mimir$
  reloadMimir: typeof reloadMimir
  inboundAddressesShared$: typeof inboundAddressesShared$
  reloadInboundAddresses: typeof reloadInboundAddresses
  mayachainConstantsState$: typeof mayachainConstantsState$
  reloadMayachainConstants: typeof reloadMayachainConstants
  mayachainLastblockState$: typeof mayachainLastblockState$
  reloadMayachainLastblock: typeof reloadMayachainLastblock
  getLiquidityProviders: typeof getLiquidityProviders
  reloadLiquidityProviders: typeof reloadLiquidityProviders
  //   getSaverProvider$: typeof getSaverProvider$
  //   reloadSaverProvider: typeof reloadSaverProvider
}

const initialContext: MayachainContextValue = {
  client$,
  clientState$,
  clientUrl$,
  setMayanodeRpcUrl,
  setMayanodeApiUrl,
  address$,
  addressUI$,
  reloadBalances,
  balances$,
  txs$,
  subscribeTx,
  resetTx,
  sendTx,
  txRD$,
  reloadFees,
  fees$,
  interact$,
  getNodeInfos$,
  explorerUrl$,
  reloadNodeInfos,
  mimir$,
  reloadMimir,
  inboundAddressesShared$,
  reloadInboundAddresses,
  reloadMayachainConstants,
  mayachainConstantsState$,
  mayachainLastblockState$,
  reloadMayachainLastblock,
  getLiquidityProviders,
  reloadLiquidityProviders
  // getSaverProvider$,
  // reloadSaverProvider
}

const MayachainContext = createContext<MayachainContextValue | null>(null)

export const MayachainProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <MayachainContext.Provider value={initialContext}>{children}</MayachainContext.Provider>
}

export const useMayachainContext = () => {
  const context = useContext(MayachainContext)
  if (!context) {
    throw new Error('Context must be used within a MayachainProvider.')
  }
  return context
}
