import { createContext, useContext } from 'react'

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
} from '../services/arb'
import { evmHDMode$, modifyStorage } from '../services/storage/common'

type ArbContextValue = {
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
  arbHDMode$: Rx.Observable<EvmHDMode>
  updateEvmHDMode: (m: EvmHDMode) => void
}

const arbHDMode$ = evmHDMode$

const updateEvmHDMode = (mode: EvmHDMode) => {
  modifyStorage(O.some({ evmDerivationMode: mode }))
}

const initialContext: ArbContextValue = {
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
  arbHDMode$,
  updateEvmHDMode
}

const ArbContext = createContext<ArbContextValue | null>(null)

export const ArbProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <ArbContext.Provider value={initialContext}>{children}</ArbContext.Provider>
}

export const useArbContext = () => {
  const context = useContext(ArbContext)
  if (!context) {
    throw new Error('Context must be used within a ArbProvider.')
  }
  return context
}
