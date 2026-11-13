import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'

import { isChainAsset } from '../../../helpers/assetHelper'
import { maxAmountToSwap } from '../../swap/Swap.utils'

/**
 * How much of `balance` a trade deposit can send.
 *
 * A chain asset pays its own network fee (and, for BTC, the TRADE+ memo output)
 * from that same balance. The maximum is unknown until the fee is known —
 * sending the full balance makes UTXO selection fail. A token pays gas from
 * the chain asset, so its own balance is spendable without that fee.
 */
export const tradeDepositSpendable = (
  asset: AnyAsset,
  balance: BaseAmount,
  fee: O.Option<BaseAmount>
): O.Option<BaseAmount> => {
  if (!isChainAsset(asset)) return O.some(balance)
  return FP.pipe(
    fee,
    O.map((feeAmount) => maxAmountToSwap({ asset, balanceAmount: balance, feeAmount }))
  )
}
