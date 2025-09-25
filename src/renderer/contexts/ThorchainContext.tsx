import React, { createContext, useContext } from 'react'

import {
  client$,
  clientState$,
  clientUrl$,
  setThornodeRpcUrl,
  setThornodeApiUrl,
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
  reloadThorchainConstants,
  thorchainConstantsState$,
  thorchainLastblockState$,
  reloadThorchainLastblock,
  getLiquidityProviders,
  reloadLiquidityProviders,
  getSaverProvider$,
  reloadSaverProvider,
  getRunePoolProvider$,
  reloadRunePoolProvider,
  getTxStatus$,
  reloadTxStatus,
  getTradeAccount$,
  reloadTradeAccount,
  getTcyClaim$,
  reloadTcyClaim,
  getTcyStaker$,
  reloadTcyStaker,
  transactionTrackingService
} from '../services/thorchain'

type ThorchainContextValue = {
  client$: typeof client$
  clientState$: typeof clientState$
  clientUrl$: typeof clientUrl$
  setThornodeRpcUrl: typeof setThornodeRpcUrl
  setThornodeApiUrl: typeof setThornodeApiUrl
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
  thorchainConstantsState$: typeof thorchainConstantsState$
  reloadThorchainConstants: typeof reloadThorchainConstants
  thorchainLastblockState$: typeof thorchainLastblockState$
  reloadThorchainLastblock: typeof reloadThorchainLastblock
  getLiquidityProviders: typeof getLiquidityProviders
  reloadLiquidityProviders: typeof reloadLiquidityProviders
  getSaverProvider$: typeof getSaverProvider$
  reloadSaverProvider: typeof reloadSaverProvider
  getRunePoolProvider$: typeof getRunePoolProvider$
  reloadRunePoolProvider: typeof reloadRunePoolProvider
  getTxStatus$: typeof getTxStatus$
  reloadTxStatus: typeof reloadTxStatus
  getTradeAccount$: typeof getTradeAccount$
  reloadTradeAccount: typeof reloadTradeAccount
  getTcyClaim$: typeof getTcyClaim$
  reloadTcyClaim: typeof reloadTcyClaim
  getTcyStaker$: typeof getTcyStaker$
  reloadTcyStaker: typeof reloadTcyStaker
  transactionTrackingService: typeof transactionTrackingService
}

const initialContext: ThorchainContextValue = {
  client$,
  clientState$,
  clientUrl$,
  setThornodeRpcUrl,
  setThornodeApiUrl,
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
  reloadThorchainConstants,
  thorchainConstantsState$,
  thorchainLastblockState$,
  reloadThorchainLastblock,
  getLiquidityProviders,
  reloadLiquidityProviders,
  getSaverProvider$,
  reloadSaverProvider,
  getRunePoolProvider$,
  reloadRunePoolProvider,
  getTxStatus$,
  reloadTxStatus,
  getTradeAccount$,
  reloadTradeAccount,
  getTcyClaim$,
  reloadTcyClaim,
  getTcyStaker$,
  reloadTcyStaker,
  transactionTrackingService
}

const ThorchainContext = createContext<ThorchainContextValue | null>(null)

export const ThorchainProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <ThorchainContext.Provider value={initialContext}>{children}</ThorchainContext.Provider>
}

export const useThorchainContext = () => {
  const context = useContext(ThorchainContext)
  if (!context) {
    throw new Error('Context must be used within a ThorchainProvider.')
  }
  return context
}
