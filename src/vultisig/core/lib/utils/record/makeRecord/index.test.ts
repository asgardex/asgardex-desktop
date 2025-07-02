import { describe, expect, it } from 'vitest'

import { makeRecord } from '.'

describe('makeRecord', () => {
  it('should create a record from keys and a value function', () => {
    const keys = ['a', 'b', 'c']
    const getValue = (key: string) => key.toUpperCase()
    const result = makeRecord(keys, getValue)

    expect(result).toEqual({
      a: 'A',
      b: 'B',
      c: 'C'
    })
  })

  it('should return an empty record when given no keys', () => {
    const keys: string[] = []
    const getValue = (key: string) => key.toUpperCase()
    const result = makeRecord(keys, getValue)

    expect(result).toEqual({})
  })

  it('should handle numeric keys', () => {
    const keys = [1, 2, 3]
    const getValue = (key: number) => key * 2
    const result = makeRecord(keys, getValue)

    expect(result).toEqual({
      1: 2,
      2: 4,
      3: 6
    })
  })

  it('should handle mixed string and numeric keys', () => {
    const keys: (string | number)[] = ['x', 42, 'y']
    const getValue = (key: string | number, index: number) => `${key}-${index}`
    const result = makeRecord(keys, getValue)

    expect(result).toEqual({
      x: 'x-0',
      42: '42-1',
      y: 'y-2'
    })
  })

  it('should overwrite duplicate keys', () => {
    const keys = ['a', 'a', 'b']
    const getValue = (key: string, index: number) => index
    const result = makeRecord(keys, getValue)

    expect(result).toEqual({
      a: 1, // Last occurrence overwrites the previous
      b: 2
    })
  })
})
