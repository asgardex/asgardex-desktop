import { GasPrices } from '@xchainjs/xchain-evm'
import { baseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'

/**
 * Applies a multiplier to gas prices to increase transaction priority
 * or help avoid "fee outside bounds" errors when network fees are very low.
 * @param gasPrices - The gas prices to multiply
 * @param multiplier - The multiplier to apply (e.g., 1, 1.5, 2, 3)
 */
export const applyGasMultiplier = (gasPrices: GasPrices, multiplier: number): GasPrices => {
  if (multiplier === 1) return gasPrices

  const multiplyAmount = (amount: ReturnType<typeof baseAmount>) => {
    const multiplied = amount.amount().multipliedBy(multiplier).integerValue(BigNumber.ROUND_CEIL)
    return baseAmount(multiplied, amount.decimal)
  }

  return {
    average: multiplyAmount(gasPrices.average),
    fast: multiplyAmount(gasPrices.fast),
    fastest: multiplyAmount(gasPrices.fastest)
  }
}
