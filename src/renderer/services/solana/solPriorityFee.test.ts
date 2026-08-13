import { baseAmount } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { toIntegerSolPriorityFee } from './solPriorityFee'

describe('toIntegerSolPriorityFee', () => {
  it('floors a fee that is not divisible by 1000', () => {
    const fee = toIntegerSolPriorityFee(baseAmount(2044280, 9))
    expect(fee.amount().toNumber()).toBe(2044000)
    expect(fee.amount().dividedBy(1000).isInteger()).toBe(true)
  })

  it('leaves a multiple of 1000 unchanged', () => {
    const fee = toIntegerSolPriorityFee(baseAmount(5000, 9))
    expect(fee.amount().toNumber()).toBe(5000)
  })
})
