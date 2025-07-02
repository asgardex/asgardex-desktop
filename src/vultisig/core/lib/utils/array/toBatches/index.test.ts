import { describe, expect, it } from 'vitest'

import { toBatches } from '.'

describe('toBatches', () => {
  it('should split an array into batches of the specified size', () => {
    const array = [1, 2, 3, 4, 5]
    const batchSize = 2

    const result = toBatches(array, batchSize)

    expect(result).toEqual([[1, 2], [3, 4], [5]])
  })

  it('should handle arrays where the length is a perfect multiple of batch size', () => {
    const array = [1, 2, 3, 4, 5, 6]
    const batchSize = 3

    const result = toBatches(array, batchSize)

    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 6]
    ])
  })

  it('should return an empty array for an empty input array', () => {
    const array: number[] = []
    const batchSize = 3

    const result = toBatches(array, batchSize)

    expect(result).toEqual([])
  })

  it('should handle batch sizes larger than the array length', () => {
    const array = [1, 2, 3]
    const batchSize = 10

    const result = toBatches(array, batchSize)

    expect(result).toEqual([[1, 2, 3]])
  })

  it('should handle a batch size of 1', () => {
    const array = [1, 2, 3]
    const batchSize = 1

    const result = toBatches(array, batchSize)

    expect(result).toEqual([[1], [2], [3]])
  })

  it('should throw an error for a batch size of 0 or less', () => {
    const array = [1, 2, 3]

    expect(() => toBatches(array, 0)).toThrowError('Batch size must be greater than 0')
    expect(() => toBatches(array, -1)).toThrowError('Batch size must be greater than 0')
  })

  it('should handle arrays with mixed data types', () => {
    const array = [1, 'a', true, null]
    const batchSize = 2

    const result = toBatches(array, batchSize)

    expect(result).toEqual([
      [1, 'a'],
      [true, null]
    ])
  })
})
