import { addressByChain$, assetAddress$ } from './address'
import { clientByChain$ } from './client'
import { assetWithDecimal$ } from './decimal'
import {
  reloadSymDepositFees,
  symDepositFees$,
  symWithdrawFee$,
  reloadWithdrawFees,
  reloadSwapFees,
  swapFees$,
  utxoFeesWithRates$,
  reloadUtxoFeesWithRates$
} from './fees'
import {
  swap$,
  swapCF$,
  poolDeposit$,
  symDeposit$,
  symWithdraw$,
  poolWithdraw$,
  transfer$,
  tradeWithdraw$
} from './transaction'

/**
 * Exports all functions and observables needed at UI level (provided by `ChainContext`)
 */
export {
  addressByChain$,
  clientByChain$,
  reloadSymDepositFees,
  symDepositFees$,
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
