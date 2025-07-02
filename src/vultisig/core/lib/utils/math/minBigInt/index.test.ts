import { describe, expect, it } from 'vitest'

import { minBigInt } from '.'

describe('minBigInt', () => {
  it('should return the smallest value from a list of bigints', () => {
    expect(minBigInt(10n, 20n, 5n, 15n)).toBe(5n)
    expect(minBigInt(1n, 2n, 3n)).toBe(1n)
    expect(minBigInt(100n, -50n, 0n, 30n)).toBe(-50n)
  })

  it('should return the single bigint when only one is provided', () => {
    expect(minBigInt(42n)).toBe(42n)
  })

  it('should throw an error when no arguments are provided', () => {
    expect(() => minBigInt()).toThrowError('minBigInt: No arguments provided')
  })

  it('should handle large bigints correctly', () => {
    const largeBigInt1 = BigInt('9223372036854775807')
    const largeBigInt2 = BigInt('-9223372036854775808')
    expect(minBigInt(largeBigInt1, largeBigInt2)).toBe(largeBigInt2)
  })

  it('should handle identical bigints correctly', () => {
    expect(minBigInt(5n, 5n, 5n)).toBe(5n)
  })

  it('should handle a mix of positive and negative bigints', () => {
    expect(minBigInt(-10n, 5n, 15n, -20n)).toBe(-20n)
  })
})
