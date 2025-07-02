/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'

import { getRecordKeys } from '.'

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
