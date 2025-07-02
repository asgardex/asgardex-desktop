/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'

import { omit } from '.'

describe('omit', () => {
  it('should omit specified keys from a record', () => {
    const record = { a: 1, b: 2, c: 3 }
    const result = omit(record, 'a', 'b')
    expect(result).toEqual({ c: 3 })
  })

  it('should return the original record when no keys are provided', () => {
    const record = { a: 1, b: 2, c: 3 }
    const result = omit(record)
    expect(result).toEqual(record)
  })

  it('should handle nonexistent keys gracefully', () => {
    const record = { a: 1, b: 2 }
    const result = omit(record, 'c' as any, 'd')
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('should handle an empty record', () => {
    const record = {}
    const result = omit(record, 'a' as unknown as never, 'b' as unknown as never)
    expect(result).toEqual({})
  })

  it('should omit multiple keys correctly', () => {
    const record = { a: 1, b: 2, c: 3, d: 4 }
    const result = omit(record, 'a', 'c', 'd')
    expect(result).toEqual({ b: 2 })
  })
})
