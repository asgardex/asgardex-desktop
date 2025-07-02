/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'

import { groupItems } from '.'

describe('groupItems', () => {
  it('should group items by a numeric key', () => {
    const items = [
      { id: 1, value: 'A' },
      { id: 2, value: 'B' },
      { id: 1, value: 'C' }
    ]

    const grouped = groupItems(items, (item) => item.id)

    expect(grouped).toEqual({
      1: [
        { id: 1, value: 'A' },
        { id: 1, value: 'C' }
      ],
      2: [{ id: 2, value: 'B' }]
    })
  })

  it('should group items by a string key', () => {
    const items = [
      { category: 'fruit', value: 'apple' },
      { category: 'vegetable', value: 'carrot' },
      { category: 'fruit', value: 'banana' }
    ]

    const grouped = groupItems(items, (item) => item.category)

    expect(grouped).toEqual({
      fruit: [
        { category: 'fruit', value: 'apple' },
        { category: 'fruit', value: 'banana' }
      ],
      vegetable: [{ category: 'vegetable', value: 'carrot' }]
    })
  })

  it('should return an empty object when given an empty array', () => {
    const items: any[] = []
    const grouped = groupItems(items, (item) => item.id)
    expect(grouped).toEqual({})
  })

  it('should handle cases where all items have the same key', () => {
    const items = [
      { id: 1, value: 'A' },
      { id: 1, value: 'B' },
      { id: 1, value: 'C' }
    ]

    const grouped = groupItems(items, (item) => item.id)

    expect(grouped).toEqual({
      1: [
        { id: 1, value: 'A' },
        { id: 1, value: 'B' },
        { id: 1, value: 'C' }
      ]
    })
  })

  it('should handle cases where keys are not unique or contiguous', () => {
    const items = [
      { id: 42, value: 'X' },
      { id: 7, value: 'Y' },
      { id: 42, value: 'Z' }
    ]

    const grouped = groupItems(items, (item) => item.id)

    expect(grouped).toEqual({
      42: [
        { id: 42, value: 'X' },
        { id: 42, value: 'Z' }
      ],
      7: [{ id: 7, value: 'Y' }]
    })
  })
})
