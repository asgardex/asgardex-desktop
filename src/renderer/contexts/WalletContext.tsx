import React, { createContext, useContext } from 'react'

import { option as O } from 'fp-ts'

type Option<T> = O.Option<T>
const { none, some } = O

import {
  client$,
  reloadBalances,
  balancesState$,
  chainBalances$,
  reloadBalancesByChain,
  keystoreService,
  selectedAsset$,
  loadTxs,
  getTxs$,
  setSelectedAsset,
  resetTxsPage,
  addLedgerAddress$,
  getLedgerAddress$,
  removeLedgerAddress,
  verifyLedgerAddress$,
  ledgerAddresses$,
  reloadPersistentLedgerAddresses,
  persistentLedgerAddresses$
} from '../services/wallet'

type WalletContextValue = {
  client$: typeof client$
  keystoreService: typeof keystoreService
  reloadBalances: typeof reloadBalances
  balancesState$: typeof balancesState$
  chainBalances$: typeof chainBalances$
  loadTxs: typeof loadTxs
  reloadBalancesByChain: typeof reloadBalancesByChain
  selectedAsset$: typeof selectedAsset$
  getTxs$: typeof getTxs$
  setSelectedAsset: typeof setSelectedAsset
  resetTxsPage: typeof resetTxsPage
  ledgerAddresses$: typeof ledgerAddresses$
  addLedgerAddress$: typeof addLedgerAddress$
  getLedgerAddress$: typeof getLedgerAddress$
  verifyLedgerAddress$: typeof verifyLedgerAddress$
  removeLedgerAddress: typeof removeLedgerAddress
  reloadPersistentLedgerAddresses: typeof reloadPersistentLedgerAddresses
  persistentLedgerAddresses$: typeof persistentLedgerAddresses$
}

const initialContext: WalletContextValue = {
  client$,
  keystoreService,
  reloadBalances,
  reloadBalancesByChain,
  loadTxs,
  balancesState$,
  chainBalances$,
  selectedAsset$,
  getTxs$,
  setSelectedAsset,
  resetTxsPage,
  ledgerAddresses$,
  addLedgerAddress$,
  getLedgerAddress$,
  verifyLedgerAddress$,
  removeLedgerAddress,
  reloadPersistentLedgerAddresses,
  persistentLedgerAddresses$
}
const WalletContext = createContext<Option<WalletContextValue>>(none)

export const WalletProvider = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <WalletContext.Provider value={some(initialContext)}>{children}</WalletContext.Provider>
)

export const useWalletContext = (): WalletContextValue => {
  const context = O.toNullable(useContext(WalletContext))
  if (!context) {
    throw new Error('Context must be used within a WalletProvider.')
  }
  return context
}
