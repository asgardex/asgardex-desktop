import { describe, expect, it } from 'vitest'

import { shouldBePresent } from '.'

describe('shouldBePresent', () => {
  it('should return the value if it is defined and not null', () => {
    const value = 42
    const result = shouldBePresent(value, 'value')
    expect(result).toBe(value)
  })

  it('should throw an error if the value is undefined', () => {
    expect(() => shouldBePresent(undefined, 'value')).toThrowError('value is required')
  })

  it('should throw an error if the value is null', () => {
    expect(() => shouldBePresent(null, 'value')).toThrowError('value is required')
  })

  it('should use the default value name in the error if not provided', () => {
    expect(() => shouldBePresent(null)).toThrowError('value is required')
  })

  it('should include the custom value name in the error if provided', () => {
    expect(() => shouldBePresent(undefined, 'customName')).toThrowError('customName is required')
  })
})
