import { describe, expect, it, vi } from 'vitest'

import { sortEntitiesWithOrder } from './EntityWithOrder'

type EntityWithOrder = {
  id: string
  order: number
}

vi.mock('../../path/to/order', () => {
  return {
    order: vi.fn()
  }
})

describe('sortEntitiesWithOrder', () => {
  it('should sort items by the order property in ascending order', () => {
    const items: EntityWithOrder[] = [
      { id: 'a', order: 2 },
      { id: 'b', order: 1 },
      { id: 'c', order: 3 }
    ]

    const result = sortEntitiesWithOrder(items)

    expect(result).toEqual([
      { id: 'b', order: 1 },
      { id: 'a', order: 2 },
      { id: 'c', order: 3 }
    ])
  })

  it('should not mutate the original array', () => {
    const items: EntityWithOrder[] = [
      { id: 'a', order: 2 },
      { id: 'b', order: 1 }
    ]

    const original = [...items]

    sortEntitiesWithOrder(items)

    expect(items).toEqual(original)
  })
})
