import { describe, expect, it } from 'vitest'

import { getLastItem } from '.'

describe('getLastItem', () => {
  it('should return the last item of a non-empty array', () => {
    expect(getLastItem([1, 2, 3])).toBe(3)
  })

  it('should return undefined for an empty array', () => {
    expect(getLastItem([])).toBeUndefined()
  })

  it('should work with readonly arrays', () => {
    const readonlyArray: readonly number[] = [10, 20, 30]
    expect(getLastItem(readonlyArray)).toBe(30)
  })

  it('should work with sparse arrays', () => {
    const sparseArray: number[] = []
    sparseArray[10] = 10
    expect(getLastItem(sparseArray)).toBe(10)
  })

  it('should work with arrays with holes', () => {
    // eslint-disable-next-line no-sparse-arrays
    const holeyArray = [1, 2, , 4]
    expect(getLastItem(holeyArray)).toBe(4)
  })
})
