import React, { createContext, useContext } from 'react'

import { option as O } from 'fp-ts'
import * as Rx from 'rxjs'

import { EvmHDMode } from '../../shared/evm/types'
import {
  client$,
  clientState$,
  txs$,
  resetTx,
  subscribeTx,
  sendTx,
  txRD$,
  address$,
  addressUI$,
  explorerUrl$,
  fees$,
  reloadFees,
  sendPoolTx$,
  approveERC20Token$,
  isApprovedERC20Token$,
  approveFee$,
  reloadApproveFee
} from '../services/avax'
import { evmHDMode$, modifyStorage } from '../services/storage/common'

type AvaxContextValue = {
  client$: typeof client$
  clientState$: typeof clientState$
  txs$: typeof txs$
  resetTx: typeof resetTx
  subscribeTx: typeof subscribeTx
  sendTx: typeof sendTx
  txRD$: typeof txRD$
  address$: typeof address$
  addressUI$: typeof addressUI$
  explorerUrl$: typeof explorerUrl$
  fees$: typeof fees$
  reloadFees: typeof reloadFees
  sendPoolTx$: typeof sendPoolTx$
  approveERC20Token$: typeof approveERC20Token$
  isApprovedERC20Token$: typeof isApprovedERC20Token$
  approveFee$: typeof approveFee$
  reloadApproveFee: typeof reloadApproveFee
  avaxHDMode$: Rx.Observable<EvmHDMode>
  updateEvmHDMode: (m: EvmHDMode) => void
}

const avaxHDMode$ = evmHDMode$

const updateEvmHDMode = (mode: EvmHDMode) => {
  modifyStorage(O.some({ evmDerivationMode: mode }))
}

const initialContext: AvaxContextValue = {
  client$,
  clientState$,
  txs$,
  resetTx,
  subscribeTx,
  sendTx,
  txRD$,
  address$,
  addressUI$,
  explorerUrl$,
  fees$,
  reloadFees,
  sendPoolTx$,
  approveERC20Token$,
  isApprovedERC20Token$,
  approveFee$,
  reloadApproveFee,
  avaxHDMode$,
  updateEvmHDMode
}

const AvaxContext = createContext<AvaxContextValue | null>(null)

export const AvaxProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <AvaxContext.Provider value={initialContext}>{children}</AvaxContext.Provider>
}

export const useAvaxContext = () => {
  const context = useContext(AvaxContext)
  if (!context) {
    throw new Error('Context must be used within a AvaxProvider.')
  }
  return context
}
