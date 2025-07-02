import { describe, expect, it } from 'vitest'

import { isEmpty } from '.'

describe('isEmpty', () => {
  it('should return true for an empty array', () => {
    expect(isEmpty([])).toBe(true)
  })

  it('should return false for a non-empty array', () => {
    expect(isEmpty([1, 2, 3])).toBe(false)
    expect(isEmpty(['a', 'b', 'c'])).toBe(false)
  })

  it('should return false for an array with one element', () => {
    expect(isEmpty([1])).toBe(false)
    expect(isEmpty(['a'])).toBe(false)
  })

  it('should handle arrays of different types', () => {
    expect(isEmpty([true, false])).toBe(false)
    expect(isEmpty([null, undefined])).toBe(false)
    expect(isEmpty([] as number[])).toBe(true) // Empty typed array
  })

  it('should handle readonly arrays', () => {
    const readonlyArray: readonly number[] = []
    expect(isEmpty(readonlyArray as number[])).toBe(true)

    const nonEmptyReadonlyArray: readonly number[] = [1, 2, 3]
    expect(isEmpty(nonEmptyReadonlyArray as number[])).toBe(false)
  })
})
