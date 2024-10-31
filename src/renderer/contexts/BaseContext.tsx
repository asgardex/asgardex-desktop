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
} from '../services/base'
import { getStorageState$, modifyStorage } from '../services/storage/common'

export type BaseContextValue = {
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
  baseHDMode$: Rx.Observable<EvmHDMode>
  updateEvmHDMode: (m: EvmHDMode) => void
}

const baseHDMode$ = FP.pipe(
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

const initialContext: BaseContextValue = {
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
  baseHDMode$,
  updateEvmHDMode
}

const BaseContext = createContext<BaseContextValue | null>(null)

export const BaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <BaseContext.Provider value={initialContext}>{children}</BaseContext.Provider>
}

export const useBaseContext = () => {
  const context = useContext(BaseContext)
  if (!context) {
    throw new Error('Context must be used within a BaseProvider.')
  }
  return context
}
