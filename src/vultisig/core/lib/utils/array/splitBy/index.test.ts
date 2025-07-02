import { describe, expect, it, vi } from 'vitest'

import { splitBy } from '.'

describe('splitBy', () => {
  it('should split items into two groups based on the organize function', () => {
    const items = [1, 2, 3, 4, 5]
    const [group0, group1] = splitBy(items, (item) => (item % 2 === 0 ? 1 : 0))
    expect(group0).toEqual([1, 3, 5])
    expect(group1).toEqual([2, 4])
  })

  it('should return all items in the first group if organize always returns 0', () => {
    const items = [1, 2, 3]
    const [group0, group1] = splitBy(items, () => 0)
    expect(group0).toEqual([1, 2, 3])
    expect(group1).toEqual([])
  })

  it('should return all items in the second group if organize always returns 1', () => {
    const items = ['a', 'b', 'c']
    const [group0, group1] = splitBy(items, () => 1)
    expect(group0).toEqual([])
    expect(group1).toEqual(['a', 'b', 'c'])
  })

  it('should handle an empty array', () => {
    const items: number[] = []
    const [group0, group1] = splitBy(items, () => 0)
    expect(group0).toEqual([])
    expect(group1).toEqual([])
  })

  it('should handle different data types in the array', () => {
    const items = [1, 'a', true, null]
    const [group0, group1] = splitBy(items, (_, index) => (index % 2 === 0 ? 0 : 1))
    expect(group0).toEqual([1, true])
    expect(group1).toEqual(['a', null])
  })

  it('should call the organize function with correct arguments', () => {
    const items = [10, 20, 30]
    const mockOrganize = vi.fn((item: number) => (item > 15 ? 1 : 0))

    const [group0, group1] = splitBy(items, mockOrganize)

    expect(mockOrganize).toHaveBeenCalledTimes(3)
    expect(mockOrganize).toHaveBeenNthCalledWith(1, 10, 0)
    expect(mockOrganize).toHaveBeenNthCalledWith(2, 20, 1)
    expect(mockOrganize).toHaveBeenNthCalledWith(3, 30, 2)
    expect(group0).toEqual([10])
    expect(group1).toEqual([20, 30])
  })

  it('should throw an error if organize returns a value other than 0 or 1', () => {
    const items = [1, 2, 3]
    const invalidOrganize = () => 2 as 0 | 1
    expect(() => splitBy(items, invalidOrganize)).toThrowError()
  })
})
