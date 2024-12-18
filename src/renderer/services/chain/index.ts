import { addressByChain$, assetAddress$ } from './address'
import { clientByChain$ } from './client'
import { assetWithDecimal$ } from './decimal'
import {
  reloadSymDepositFees,
  symDepositFees$,
  reloadSaverDepositFee,
  saverDepositFee$,
  symWithdrawFee$,
  reloadWithdrawFees,
  reloadSwapFees,
  swapFees$,
  utxoFeesWithRates$,
  reloadUtxoFeesWithRates$
} from './fees'
import {
  swap$,
  saverDeposit$,
  symDeposit$,
  symWithdraw$,
  saverWithdraw$,
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
  reloadSaverDepositFee,
  saverDepositFee$,
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
