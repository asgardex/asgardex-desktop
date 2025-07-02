import { describe, expect, it } from 'vitest'

import { haveSameContent } from '.'

describe('haveSameContent', () => {
  it('should return true for two identical arrays', () => {
    expect(haveSameContent([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(haveSameContent(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
  })

  it('should return false for arrays with different lengths', () => {
    expect(haveSameContent([1, 2, 3], [1, 2])).toBe(false)
    expect(haveSameContent(['a', 'b'], ['a', 'b', 'c'])).toBe(false)
  })

  it('should return false for arrays with same length but different content', () => {
    expect(haveSameContent([1, 2, 3], [1, 2, 4])).toBe(false)
    expect(haveSameContent(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(false)
  })

  it('should return true for two empty arrays', () => {
    expect(haveSameContent([], [])).toBe(true)
  })

  it('should work with readonly arrays', () => {
    const readonlyArray1: readonly number[] = [1, 2, 3]
    const readonlyArray2: readonly number[] = [1, 2, 3]
    expect(haveSameContent(readonlyArray1, readonlyArray2)).toBe(true)

    const readonlyArray3: readonly number[] = [1, 2, 4]
    expect(haveSameContent(readonlyArray1, readonlyArray3)).toBe(false)
  })

  it('should return false for arrays with same elements but different order', () => {
    expect(haveSameContent([1, 2, 3], [3, 2, 1])).toBe(false)
  })

  it('should handle arrays with mixed types correctly', () => {
    expect(haveSameContent([1, 'a', true], [1, 'a', true])).toBe(true)
    expect(haveSameContent([1, 'a', true], [true, 'a', 1])).toBe(false)
  })
})
