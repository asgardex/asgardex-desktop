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
} from '../services/bsc'
import { getStorageState$, modifyStorage } from '../services/storage/common'

export type BscContextValue = {
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
  bscHDMode$: Rx.Observable<EvmHDMode>
  updateEvmHDMode: (m: EvmHDMode) => void
}

const bscHDMode$ = FP.pipe(
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

const initialContext: BscContextValue = {
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
  bscHDMode$,
  updateEvmHDMode
}

const BscContext = createContext<BscContextValue | null>(null)

export const BscProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <BscContext.Provider value={initialContext}>{children}</BscContext.Provider>
}

export const useBscContext = () => {
  const context = useContext(BscContext)
  if (!context) {
    throw new Error('Context must be used within a BscProvider.')
  }
  return context
}
