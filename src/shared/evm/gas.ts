import { FeeOption } from '@xchainjs/xchain-client'
import { GasPrices } from '@xchainjs/xchain-evm'
import { BaseAmount, baseAmount } from '@xchainjs/xchain-util'
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

/**
 * Fee fields for `@xchainjs/xchain-evm` `transfer()` on EIP-1559 networks.
 *
 * Passing `gasPrice` makes xchain upgrade type-1 → type-2 by setting
 * `maxFeePerGas = maxPriorityFeePerGas = gasPrice` with **no base-fee headroom**.
 * When base fee ticks up, `maxFee < baseFee` and the tx stalls (seen on ETH
 * DAI→BTC `depositWithExpiry`).
 *
 * Passing only `maxPriorityFeePerGas` lets xchain set
 * `maxFeePerGas = 2 * baseFee + tip`, which is the ethers v5-compatible path.
 */
export type Eip1559TransferFees = {
  maxPriorityFeePerGas: BaseAmount
}

export const eip1559FeesFromGasPrices = (
  gasPrices: GasPrices,
  feeOption: FeeOption = FeeOption.Fast
): Eip1559TransferFees => ({
  maxPriorityFeePerGas: gasPrices[feeOption]
})
