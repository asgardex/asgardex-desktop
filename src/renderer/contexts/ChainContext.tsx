import React, { createContext, useContext } from 'react'

import {
  addressByChain$,
  clientByChain$,
  symDepositFees$,
  reloadSymDepositFees,
  saverDepositFee$,
  reloadSaverDepositFee,
  symWithdrawFee$,
  reloadWithdrawFees,
  reloadSwapFees,
  swapFees$,
  assetAddress$,
  swap$,
  saverDeposit$,
  symDeposit$,
  symWithdraw$,
  saverWithdraw$,
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
  saverDepositFee$: typeof saverDepositFee$
  reloadSaverDepositFee: typeof reloadSaverDepositFee
  symWithdrawFee$: typeof symWithdrawFee$
  reloadWithdrawFees: typeof reloadWithdrawFees
  reloadSwapFees: typeof reloadSwapFees
  swapFees$: typeof swapFees$
  assetAddress$: typeof assetAddress$
  swap$: typeof swap$
  saverDeposit$: typeof saverDeposit$
  symDeposit$: typeof symDeposit$
  symWithdraw$: typeof symWithdraw$
  saverWithdraw$: typeof saverWithdraw$
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
  saverDepositFee$,
  reloadSaverDepositFee,
  symWithdrawFee$,
  reloadWithdrawFees,
  reloadSwapFees,
  swapFees$,
  assetAddress$,
  swap$,
  saverDeposit$,
  symDeposit$,
  symWithdraw$,
  saverWithdraw$,
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
