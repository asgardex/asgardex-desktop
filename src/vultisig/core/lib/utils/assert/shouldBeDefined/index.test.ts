import { describe, expect, it } from 'vitest'

import { shouldBeDefined } from '.'

describe('shouldBeDefined', () => {
  it('should return the value if it is defined', () => {
    const value = 42
    const result = shouldBeDefined(value, 'value')
    expect(result).toBe(value)
  })

  it('should throw an error if the value is undefined', () => {
    expect(() => shouldBeDefined(undefined, 'value')).toThrowError('value is undefined')
  })

  it('should use the default value name in the error if not provided', () => {
    expect(() => shouldBeDefined(undefined)).toThrowError('value is undefined')
  })

  it('should include the custom value name in the error if provided', () => {
    expect(() => shouldBeDefined(undefined, 'customName')).toThrowError('customName is undefined')
  })
})
