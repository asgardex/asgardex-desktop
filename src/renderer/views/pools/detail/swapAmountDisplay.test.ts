import { baseAmount } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { balanceCovers, formatSwapAmount, pairRate, swapAmountFromPercent } from './swapAmountDisplay'

describe('swapAmountDisplay', () => {
  const ethBalance = baseAmount('28575133772992115', 18)

  it('caps a wallet balance at 8 decimals and rounds down', () => {
    expect(formatSwapAmount(ethBalance)).toBe('0.02857513')
  })

  it('trims trailing zeros', () => {
    expect(formatSwapAmount(baseAmount(100_000_000, 8))).toBe('1')
    expect(formatSwapAmount(baseAmount(150_000_000, 8))).toBe('1.5')
  })

  it('returns 0 for an empty balance', () => {
    expect(formatSwapAmount(baseAmount(0, 18))).toBe('0')
  })

  it('applies a percent before the same cap', () => {
    expect(swapAmountFromPercent(ethBalance, 25)).toBe('0.00714378')
    expect(swapAmountFromPercent(ethBalance, 100)).toBe('0.02857513')
  })

  it('covers a buy only when the spendable balance is at least the cost', () => {
    expect(balanceCovers(baseAmount(0, 8), baseAmount(1_629_623_100, 8))).toBe(false)
    expect(balanceCovers(baseAmount(1_629_623_100, 8), baseAmount(1_629_623_100, 8))).toBe(true)
    expect(balanceCovers(baseAmount(1_629_623_099, 8), baseAmount(1_629_623_100, 8))).toBe(false)
    // L1 USDC is 6 dp. 10 USDC covers a 9.5 trade-unit cost and not 10.5.
    expect(balanceCovers(baseAmount(10_000_000, 6), baseAmount(950_000_000, 8))).toBe(true)
    expect(balanceCovers(baseAmount(10_000_000, 6), baseAmount(1_050_000_000, 8))).toBe(false)
    expect(balanceCovers(baseAmount(1, 8), baseAmount(0, 8))).toBe(false)
  })

  it('quotes counter received per 1 unit of the sized asset', () => {
    expect(pairRate('35.363178', baseAmount(1_412_000, 8))).toBe('0.00039928')
    expect(pairRate('0', baseAmount(1, 8))).toBeNull()
    expect(pairRate('1', baseAmount(0, 8))).toBeNull()
  })
})
