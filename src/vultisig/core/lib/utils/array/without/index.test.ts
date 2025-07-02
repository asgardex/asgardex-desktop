import { describe, expect, it } from 'vitest'

import { without } from '.'

describe('without', () => {
  it('should remove specified items from the array', () => {
    const items = [1, 2, 3, 4, 5]
    const result = without(items, 2, 4)
    expect(result).toEqual([1, 3, 5])
  })

  it('should return the original array if no items are specified to remove', () => {
    const items = [1, 2, 3]
    const result = without(items)
    expect(result).toEqual([1, 2, 3])
  })

  it('should return an empty array if all items are removed', () => {
    const items = [1, 2, 3]
    const result = without(items, 1, 2, 3)
    expect(result).toEqual([])
  })

  it('should handle an empty array gracefully', () => {
    const items: number[] = []
    const result = without(items, 1, 2, 3)
    expect(result).toEqual([])
  })

  it('should not mutate the original array', () => {
    const items = [1, 2, 3]
    const result = without(items, 2)
    expect(result).not.toBe(items)
    expect(items).toEqual([1, 2, 3])
  })

  it('should handle arrays with mixed data types', () => {
    const items = [1, 'a', true, null]
    const result = without(items, 'a', true)
    expect(result).toEqual([1, null])
  })

  it('should handle duplicates in the array', () => {
    const items = [1, 2, 2, 3, 4]
    const result = without(items, 2)
    expect(result).toEqual([1, 3, 4])
  })

  it('should handle duplicates in the items to remove', () => {
    const items = [1, 2, 3, 4]
    const result = without(items, 2, 2, 3)
    expect(result).toEqual([1, 4])
  })

  it('should not remove items if they are not in the array', () => {
    const items = [1, 2, 3]
    const result = without(items, 4, 5)
    expect(result).toEqual([1, 2, 3])
  })

  it('should work with readonly arrays', () => {
    const items: readonly number[] = [1, 2, 3, 4]
    const result = without(items, 2, 4)
    expect(result).toEqual([1, 3])
  })
})
