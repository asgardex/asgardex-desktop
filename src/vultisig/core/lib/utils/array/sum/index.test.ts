import { describe, expect, it } from 'vitest'

import { sum } from '.'

describe('sum', () => {
  it('should return the sum of all numbers in the array', () => {
    expect(sum([1, 2, 3, 4, 5])).toBe(15)
    expect(sum([10, 20, 30])).toBe(60)
  })

  it('should return 0 for an empty array', () => {
    expect(sum([])).toBe(0)
  })

  it('should correctly handle negative numbers', () => {
    expect(sum([-1, -2, -3])).toBe(-6)
    expect(sum([10, -5, -5])).toBe(0)
  })

  it('should handle arrays with a single element', () => {
    expect(sum([42])).toBe(42)
    expect(sum([-10])).toBe(-10)
  })

  it('should handle arrays with decimals', () => {
    expect(sum([1.1, 2.2, 3.3])).toBeCloseTo(6.6, 5)
    expect(sum([0.1, 0.2, 0.3])).toBeCloseTo(0.6, 5)
  })

  it('should return 0 for an array of all zeros', () => {
    expect(sum([0, 0, 0, 0])).toBe(0)
  })
})
