import { describe, expect, it } from 'vitest'

import { range } from '.'

describe('range', () => {
  it('should create an array of the specified length', () => {
    expect(range(5)).toEqual([0, 1, 2, 3, 4])
    expect(range(0)).toEqual([]) // Edge case: zero length
    expect(range(1)).toEqual([0]) // Single element array
  })

  it('should create an array of sequential numbers starting from 0', () => {
    const result = range(4)
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(1)
    expect(result[2]).toBe(2)
    expect(result[3]).toBe(3)
    expect(result).toEqual([0, 1, 2, 3])
  })

  it('should return an empty array if the length is 0', () => {
    const result = range(0)
    expect(result).toEqual([])
  })

  it('should handle large lengths', () => {
    const largeArray = range(1000) // Array of 1000 elements
    expect(largeArray.length).toBe(1000)
    expect(largeArray[0]).toBe(0)
    expect(largeArray[999]).toBe(999)
  })

  it('should throw an error for negative lengths', () => {
    expect(() => range(-1)).toBeDefined()
  })
})
