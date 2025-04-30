import React, { createContext, useContext } from 'react'

import {
  addressByChain$,
  clientByChain$,
  symDepositFees$,
  reloadSymDepositFees,
  symWithdrawFee$,
  reloadWithdrawFees,
  reloadSwapFees,
  swapFees$,
  assetAddress$,
  swap$,
  swapCF$,
  poolDeposit$,
  symDeposit$,
  symWithdraw$,
  poolWithdraw$,
  tradeWithdraw$,
  transfer$,
  assetWithDecimal$,
  utxoFeesWithRates$,
  reloadUtxoFeesWithRates$
} from '../services/chain'

type ChainContextValue = {
  addressByChain$: typeof addressByChain$
  clientByChain$: typeof clientByChain$
  symDepositFees$: typeof symDepositFees$
  reloadSymDepositFees: typeof reloadSymDepositFees
  symWithdrawFee$: typeof symWithdrawFee$
  reloadWithdrawFees: typeof reloadWithdrawFees
  reloadSwapFees: typeof reloadSwapFees
  swapFees$: typeof swapFees$
  assetAddress$: typeof assetAddress$
  swap$: typeof swap$
  swapCF$: typeof swapCF$
  poolDeposit$: typeof poolDeposit$
  symDeposit$: typeof symDeposit$
  symWithdraw$: typeof symWithdraw$
  poolWithdraw$: typeof poolWithdraw$
  tradeWithdraw$: typeof tradeWithdraw$
  transfer$: typeof transfer$
  assetWithDecimal$: typeof assetWithDecimal$
  utxoFeesWithRates$: typeof utxoFeesWithRates$
  reloadUtxoFeesWithRates$: typeof reloadUtxoFeesWithRates$
}

const initialContext: ChainContextValue = {
  addressByChain$,
  clientByChain$,
  symDepositFees$,
  reloadSymDepositFees,
  symWithdrawFee$,
  reloadWithdrawFees,
  reloadSwapFees,
  swapFees$,
  assetAddress$,
  swap$,
  swapCF$,
  poolDeposit$,
  symDeposit$,
  symWithdraw$,
  poolWithdraw$,
  tradeWithdraw$,
  transfer$,
  assetWithDecimal$,
  utxoFeesWithRates$,
  reloadUtxoFeesWithRates$
}
const ChainContext = createContext<ChainContextValue | null>(null)

export const ChainProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <ChainContext.Provider value={initialContext}>{children}</ChainContext.Provider>
}

export const useChainContext = () => {
  const context = useContext(ChainContext)
  if (!context) {
    throw new Error('Context must be used within a ChainProvider.')
  }
  return context
}
