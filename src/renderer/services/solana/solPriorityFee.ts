import { baseAmount, BaseAmount } from '@xchainjs/xchain-util'

/**
 * xchain-solana calls `setComputeUnitPrice({ microLamports: fee / 1000 })`.
 * Floor to a multiple of 1000 so that value is an integer BigInt.
 */
export const toIntegerSolPriorityFee = (fee: BaseAmount): BaseAmount => {
  const microLamports = fee.amount().dividedToIntegerBy(1000)
  return baseAmount(microLamports.times(1000), fee.decimal)
}
