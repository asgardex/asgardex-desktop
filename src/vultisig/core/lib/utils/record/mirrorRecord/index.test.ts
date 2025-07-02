import { describe, expect, it } from 'vitest'

import { mirrorRecord } from '.'

describe('mirrorRecord', () => {
  it('should mirror keys and values correctly for a simple record', () => {
    const record = { a: 1, b: 2, c: 3 }
    const result = mirrorRecord(record)
    expect(result).toEqual({ 1: 'a', 2: 'b', 3: 'c' })
  })

  it('should return an empty record when input is an empty record', () => {
    const record = {}
    const result = mirrorRecord(record)
    expect(result).toEqual({})
  })

  it('should overwrite keys when there are duplicate values', () => {
    const record = { a: 1, b: 1, c: 2 }
    const result = mirrorRecord(record)
    expect(result).toEqual({ 1: 'b', 2: 'c' }) // 'b' overwrites 'a' for value 1
  })

  it('should handle mixed types for keys and values', () => {
    const record = { 1: 'a', b: 2 }
    const result = mirrorRecord(record)
    expect(result).toEqual({ a: '1', 2: 'b' })
  })

  it('should handle numeric values and string keys correctly', () => {
    const record = { a: 1, b: 2 }
    const result = mirrorRecord(record)
    expect(result).toEqual({ 1: 'a', 2: 'b' })
  })
})
