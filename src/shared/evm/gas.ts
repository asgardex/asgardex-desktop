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

/**
 * EIP-1559 maxFeePerGas = 2 * baseFee + tip (ethers v5 / xchain-evm default).
 * Use for Max-send feeCap reclamping so reserved gas matches what transfer() will attach.
 */
export const eip1559MaxFeePerGas = (tip: BaseAmount, baseFeePerGas: bigint): BaseAmount => {
  const maxFee = baseFeePerGas * BigInt(2) + BigInt(tip.amount().toFixed(0))
  return baseAmount(maxFee.toString(), tip.decimal)
}

/**
 * Fee fields for `@xchainjs/xchain-evm` `transfer()`, with `maxFeePerGas` always set explicitly
 * on EIP-1559 networks.
 *
 * xchain only derives `maxFeePerGas` from a tip when `block.baseFeePerGas` is truthy.
 * BSC reports a base fee of `0`, so the tip-only path left `maxFeePerGas` unset and ethers
 * rejected the tx ("priorityFee cannot be more than maxFee"). Passing both avoids that.
 *
 * Chains without a base fee fall back to a legacy `gasPrice`.
 */
export type EvmTransferFees = { maxFeePerGas: BaseAmount; maxPriorityFeePerGas: BaseAmount } | { gasPrice: BaseAmount }

export const evmTransferFees = (
  gasPrices: GasPrices,
  feeOption: FeeOption = FeeOption.Fast,
  baseFeePerGas: bigint | null | undefined
): EvmTransferFees => {
  const tip = gasPrices[feeOption]
  return baseFeePerGas != null
    ? { maxFeePerGas: eip1559MaxFeePerGas(tip, baseFeePerGas), maxPriorityFeePerGas: tip }
    : { gasPrice: tip }
}
