import { FeeOption } from '@xchainjs/xchain-client'
import { baseAmount } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { applyGasMultiplier, eip1559FeesFromGasPrices, eip1559MaxFeePerGas } from './gas'

describe('shared/evm/gas', () => {
  const gasPrices = {
    average: baseAmount(1_000_000_000, 18),
    fast: baseAmount(1_500_000_000, 18),
    fastest: baseAmount(2_000_000_000, 18)
  }

  it('applyGasMultiplier leaves prices unchanged at 1x', () => {
    expect(applyGasMultiplier(gasPrices, 1)).toEqual(gasPrices)
  })

  it('applyGasMultiplier scales all tiers', () => {
    const scaled = applyGasMultiplier(gasPrices, 2)
    expect(scaled.average.amount().toNumber()).toBe(2_000_000_000)
    expect(scaled.fast.amount().toNumber()).toBe(3_000_000_000)
    expect(scaled.fastest.amount().toNumber()).toBe(4_000_000_000)
  })

  it('eip1559FeesFromGasPrices maps FeeOption to maxPriorityFeePerGas only', () => {
    expect(eip1559FeesFromGasPrices(gasPrices, FeeOption.Fast)).toEqual({
      maxPriorityFeePerGas: gasPrices.fast
    })
    expect(eip1559FeesFromGasPrices(gasPrices, FeeOption.Average)).toEqual({
      maxPriorityFeePerGas: gasPrices.average
    })
    expect(eip1559FeesFromGasPrices(gasPrices, FeeOption.Fastest)).toEqual({
      maxPriorityFeePerGas: gasPrices.fastest
    })
  })

  it('defaults eip1559FeesFromGasPrices to Fast', () => {
    expect(eip1559FeesFromGasPrices(gasPrices)).toEqual({
      maxPriorityFeePerGas: gasPrices.fast
    })
  })

  it('eip1559MaxFeePerGas is 2*baseFee + tip', () => {
    const tip = baseAmount(1_500_000_000, 18)
    const baseFee = BigInt(20_000_000_000)
    const maxFee = eip1559MaxFeePerGas(tip, baseFee)
    // 2 * 20 gwei + 1.5 gwei = 41.5 gwei
    expect(maxFee.amount().toFixed(0)).toBe('41500000000')
    expect(maxFee.decimal).toBe(18)
  })
})
