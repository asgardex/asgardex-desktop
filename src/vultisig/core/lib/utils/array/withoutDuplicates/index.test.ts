import { describe, expect, it } from 'vitest'

import { withoutDuplicates } from '.'

describe('withoutDuplicates', () => {
  it('should remove duplicate numbers from an array', () => {
    const items = [1, 2, 2, 3, 4, 4, 5]
    const result = withoutDuplicates(items)
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('should remove duplicate strings from an array', () => {
    const items = ['a', 'b', 'a', 'c', 'c', 'd']
    const result = withoutDuplicates(items)
    expect(result).toEqual(['a', 'b', 'c', 'd'])
  })

  it('should handle an empty array', () => {
    const items: number[] = []
    const result = withoutDuplicates(items)
    expect(result).toEqual([])
  })

  it('should handle an array with no duplicates', () => {
    const items = [1, 2, 3, 4, 5]
    const result = withoutDuplicates(items)
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('should remove null and undefined values along with duplicates', () => {
    const items = [1, 'a', 1, true, 'a', null, undefined, null]
    const result = withoutDuplicates(items)
    expect(result).toEqual([1, 'a', true])
  })

  it('should handle duplicates based on a custom equality function', () => {
    const items = [{ id: 1, value: 'a' }, { id: 2, value: 'b' }, { id: 1, value: 'c' }, null, undefined]
    const result = withoutDuplicates(items, (a, b) => a?.id === b?.id)
    expect(result).toEqual([
      { id: 1, value: 'a' },
      { id: 2, value: 'b' }
    ])
  })

  it('should not mutate the original array', () => {
    const items = [1, 2, 2, 3, null, undefined]
    const result = withoutDuplicates(items)
    expect(result).not.toBe(items)
    expect(items).toEqual([1, 2, 2, 3, null, undefined])
  })

  it('should handle complex nested objects with a custom equality function', () => {
    const items = [
      { nested: { id: 1 }, value: 'a' },
      { nested: { id: 2 }, value: 'b' },
      { nested: { id: 1 }, value: 'c' },
      null,
      undefined
    ]
    const result = withoutDuplicates(items, (a, b) => a?.nested.id === b?.nested.id)
    expect(result).toEqual([
      { nested: { id: 1 }, value: 'a' },
      { nested: { id: 2 }, value: 'b' }
    ])
  })

  it('should return the first occurrence of duplicate items and exclude null and undefined', () => {
    const items = [2, 1, 2, 3, 1, null, undefined]
    const result = withoutDuplicates(items)
    expect(result).toEqual([2, 1, 3])
  })
})
