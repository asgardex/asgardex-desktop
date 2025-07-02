import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isEmpty } from '../array/isEmpty'
import { defaultOrder, orderIncrementStep } from './config'
import { getLastItemOrder } from './getLastItemOrder'

vi.mock('../array/isEmpty', () => ({
  isEmpty: vi.fn()
}))

describe('getLastItemOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return the default order when the list is empty', () => {
    vi.mocked(isEmpty).mockReturnValue(true)

    expect(getLastItemOrder([])).toBe(defaultOrder)
    expect(isEmpty).toHaveBeenCalledWith([])
  })

  it('should return the maximum order incremented by the step when the list is not empty', () => {
    const orders = [1000000, 2000000, 3000000]
    vi.mocked(isEmpty).mockReturnValue(false)

    expect(getLastItemOrder(orders)).toBe(3000000 + orderIncrementStep)
    expect(isEmpty).toHaveBeenCalledWith(orders)
  })

  it('should handle a single item in the list', () => {
    const orders = [5000000]
    vi.mocked(isEmpty).mockReturnValue(false)

    expect(getLastItemOrder(orders)).toBe(5000000 + orderIncrementStep)
    expect(isEmpty).toHaveBeenCalledWith(orders)
  })

  it('should handle negative numbers in the orders list', () => {
    const orders = [-2000000, -1000000]
    vi.mocked(isEmpty).mockReturnValue(false)

    expect(getLastItemOrder(orders)).toBe(-1000000 + orderIncrementStep)
    expect(isEmpty).toHaveBeenCalledWith(orders)
  })

  it('should handle an empty list even with a mocked implementation', () => {
    vi.mocked(isEmpty).mockReturnValue(true)

    expect(getLastItemOrder([])).toBe(defaultOrder)
    expect(isEmpty).toHaveBeenCalledWith([])
  })

  it('should work correctly when the orders list contains duplicate maximum values', () => {
    const orders = [1000000, 2000000, 2000000]
    vi.mocked(isEmpty).mockReturnValue(false)

    expect(getLastItemOrder(orders)).toBe(2000000 + orderIncrementStep)
    expect(isEmpty).toHaveBeenCalledWith(orders)
  })
})
