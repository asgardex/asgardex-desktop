import * as RD from '@devexperts/remote-data-ts'

import { MAYAChain, THORChain } from '../../shared/utils/chainIds'
import { getLimit, selectProtocolLimit } from './useProtocolLimit'

describe('hooks/useProtocolLimit', () => {
  it('non reached + other values', () => {
    const { reached, totalActiveBondAmount, totalPooledRuneAmount } = getLimit('50', '100')
    expect(reached).toBeFalsy()
    expect(totalPooledRuneAmount.amount().toNumber()).toEqual(50)
    expect(totalActiveBondAmount.amount().toNumber()).toEqual(100)
  })

  it('reached (equal)', () => {
    const { reached } = getLimit('100', '100')
    expect(reached).toBeTruthy()
  })

  it('reached (LP to high)', () => {
    const { reached } = getLimit('101', '100')
    expect(reached).toBeTruthy()
  })

  it('reached (no bonds)', () => {
    const { reached } = getLimit('1', '')
    expect(reached).toBeTruthy()
  })

  it('no reached (low LP)', () => {
    const { reached } = getLimit('50', '100')
    expect(reached).toBeFalsy()
  })

  it('no reached (no LP)', () => {
    const { reached } = getLimit('', '100')
    expect(reached).toBeFalsy()
  })

  it('selects the RUNE limit on THOR, the CACAO limit on MAYA, and nothing on Chainflip', () => {
    const thor = RD.success(getLimit('10', '20'))
    const maya = RD.success(getLimit('50', '20', 10))
    expect(selectProtocolLimit(THORChain, thor, maya)).toBe(thor)
    expect(selectProtocolLimit(MAYAChain, thor, maya)).toBe(maya)
    expect(selectProtocolLimit('CHAINFLIP', thor, maya)).toEqual(RD.initial)
  })
})
