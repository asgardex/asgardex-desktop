/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'

import { getRecordKeys } from '../getRecordKeys'
import { haveEqualFields } from '.'

describe('getRecordKeys', () => {
  it('should return keys of a string-keyed record', () => {
    const record = { a: 1, b: 2, c: 3 }
    const result = getRecordKeys(record)
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('should return keys of a number-keyed record', () => {
    const record = { 1: 'a', 2: 'b', 3: 'c' }
    const result = getRecordKeys(record)
    expect(result).toEqual(['1', '2', '3'])
  })

  it('should return an empty array for an empty record', () => {
    const record = {}
    const result = getRecordKeys(record)
    expect(result).toEqual([])
  })

  it('should handle mixed type keys gracefully', () => {
    const record: Record<string | number, any> = { a: 1, 2: 'b', c: 3 }
    const result = getRecordKeys(record)
    expect(result).toEqual(['2', 'a', 'c'])
  })
})

describe('haveEqualFields', () => {
  it('should return true when all fields are equal across records', () => {
    const records = [
      { id: 1, name: 'Alice', age: 25 },
      { id: 2, name: 'Alice', age: 25 }
    ]
    const result = haveEqualFields(['name', 'age'], ...records)
    expect(result).toBe(true)
  })

  it('should return false when any field differs across records', () => {
    const records = [
      { id: 1, name: 'Alice', age: 25 },
      { id: 2, name: 'Bob', age: 25 }
    ]
    const result = haveEqualFields(['name', 'age'], ...records)
    expect(result).toBe(false)
  })

  it('should return true when no fields are provided', () => {
    const records = [
      { id: 1, name: 'Alice', age: 25 },
      { id: 2, name: 'Bob', age: 25 }
    ]
    const result = haveEqualFields([], ...records)
    expect(result).toBe(true)
  })

  it('should return true for a single record', () => {
    const records = [{ id: 1, name: 'Alice', age: 25 }]
    const result = haveEqualFields(['name', 'age'], ...records)
    expect(result).toBe(true)
  })

  it('should return true for an empty record array', () => {
    const records: Record<string, any>[] = []
    const result = haveEqualFields(['name', 'age'], ...records)
    expect(result).toBe(true)
  })
})
