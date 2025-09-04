import React, { createContext, useContext } from 'react'

import {
  addressByChain$,
  clientByChain$,
  symDepositFees$,
  depositFees$,
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
  reloadUtxoFeesWithRates$,
  evmFees$,
  standaloneLedgerFees$,
  reloadStandaloneLedgerFees
} from '../services/chain'

type ChainContextValue = {
  addressByChain$: typeof addressByChain$
  clientByChain$: typeof clientByChain$
  symDepositFees$: typeof symDepositFees$
  depositFees$: typeof depositFees$
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
  evmFees$: typeof evmFees$
  standaloneLedgerFees$: typeof standaloneLedgerFees$
  reloadStandaloneLedgerFees: typeof reloadStandaloneLedgerFees
}

const initialContext: ChainContextValue = {
  addressByChain$,
  clientByChain$,
  symDepositFees$,
  depositFees$,
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
  reloadUtxoFeesWithRates$,
  evmFees$,
  standaloneLedgerFees$,
  reloadStandaloneLedgerFees
}
const ChainContext = createContext<ChainContextValue | null>(null)

export const ChainProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return <ChainContext.Provider value={initialContext}>{children}</ChainContext.Provider>
}

export const useChainContext = () => {
  const context = useContext(ChainContext)
  if (!context) {
    throw new Error('Context must be used within a ChainProvider.')
  }
  return context
}
