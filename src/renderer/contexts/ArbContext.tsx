import React, { createContext, useContext } from 'react'

import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { DEFAULT_EVM_HD_MODE, EvmHDMode } from '../../shared/evm/types'
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
import { getStorageState$, modifyStorage } from '../services/storage/common'

export type ArbContextValue = {
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

const arbHDMode$ = FP.pipe(
  getStorageState$,
  RxOp.map(
    FP.flow(
      O.map(({ evmDerivationMode }) => evmDerivationMode),
      O.getOrElse(() => DEFAULT_EVM_HD_MODE)
    )
  ),
  RxOp.distinctUntilChanged()
)

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

export const ArbProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <ArbContext.Provider value={initialContext}>{children}</ArbContext.Provider>
}

export const useArbContext = () => {
  const context = useContext(ArbContext)
  if (!context) {
    throw new Error('Context must be used within a ArbProvider.')
  }
  return context
}
