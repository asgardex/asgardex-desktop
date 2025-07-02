import { describe, expect, it } from 'vitest'

import { withoutNullOrUndefined } from '.'

describe('withoutNullOrUndefined', () => {
  it('should remove null and undefined values from an array', () => {
    const items = [1, null, 2, undefined, 3]
    const result = withoutNullOrUndefined(items)
    expect(result).toEqual([1, 2, 3])
  })

  it('should return the original array if there are no null or undefined values', () => {
    const items = [1, 2, 3]
    const result = withoutNullOrUndefined(items)
    expect(result).toEqual([1, 2, 3])
  })

  it('should return an empty array if all values are null or undefined', () => {
    const items = [null, undefined, null]
    const result = withoutNullOrUndefined(items)
    expect(result).toEqual([])
  })

  it('should handle mixed data types with null and undefined', () => {
    const items = [1, 'a', null, true, undefined]
    const result = withoutNullOrUndefined(items)
    expect(result).toEqual([1, 'a', true])
  })

  it('should handle an empty array', () => {
    const items: Array<number | null | undefined> = []
    const result = withoutNullOrUndefined(items)
    expect(result).toEqual([])
  })

  it('should not mutate the original array', () => {
    const items = [1, null, 2]
    const result = withoutNullOrUndefined(items)
    expect(result).not.toBe(items)
    expect(items).toEqual([1, null, 2])
  })

  it('should handle arrays with only one non-null or non-undefined value', () => {
    const items = [null, undefined, 42]
    const result = withoutNullOrUndefined(items)
    expect(result).toEqual([42])
  })
})
