import { describe, expect, it } from 'vitest'

import { withoutUndefined } from '.'

describe('withoutUndefined', () => {
  it('should remove undefined values from an array', () => {
    const items = [1, undefined, 2, 3, undefined]
    const result = withoutUndefined(items)
    expect(result).toEqual([1, 2, 3])
  })

  it('should return the original array if there are no undefined values', () => {
    const items = [1, 2, 3]
    const result = withoutUndefined(items)
    expect(result).toEqual([1, 2, 3])
  })

  it('should return an empty array if all values are undefined', () => {
    const items: Array<number | undefined> = [undefined, undefined]
    const result = withoutUndefined(items)
    expect(result).toEqual([])
  })

  it('should handle mixed data types with undefined', () => {
    const items = [1, 'a', undefined, true]
    const result = withoutUndefined(items)
    expect(result).toEqual([1, 'a', true])
  })

  it('should handle an empty array', () => {
    const items: Array<number | undefined> = []
    const result = withoutUndefined(items)
    expect(result).toEqual([])
  })

  it('should not mutate the original array', () => {
    const items = [1, undefined, 2]
    const result = withoutUndefined(items)
    expect(result).not.toBe(items)
    expect(items).toEqual([1, undefined, 2])
  })

  it('should handle arrays with only one non-undefined value', () => {
    const items = [undefined, undefined, 42]
    const result = withoutUndefined(items)
    expect(result).toEqual([42])
  })
})
