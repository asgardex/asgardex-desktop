import { describe, expect, it } from 'vitest'

import { convertDuration } from './convertDuration'

describe('convertDuration', () => {
  it('should convert milliseconds to seconds correctly', () => {
    const result = convertDuration(1000, 'ms', 's')
    expect(result).toBe(1)
  })

  it('should convert seconds to milliseconds correctly', () => {
    const result = convertDuration(1, 's', 'ms')
    expect(result).toBe(1000)
  })

  it('should convert minutes to milliseconds correctly', () => {
    const result = convertDuration(1, 'min', 'ms')
    expect(result).toBe(60000)
  })

  it('should convert hours to seconds correctly', () => {
    const result = convertDuration(1, 'h', 's')
    expect(result).toBe(3600)
  })

  it('should convert days to hours correctly', () => {
    const result = convertDuration(1, 'd', 'h')
    expect(result).toBe(24)
  })

  it('should convert weeks to days correctly', () => {
    const result = convertDuration(1, 'w', 'd')
    expect(result).toBe(7)
  })

  it('should convert nanoseconds to milliseconds correctly', () => {
    const result = convertDuration(1000000, 'ns', 'ms')
    expect(result).toBe(1)
  })

  it('should handle no conversion (same unit)', () => {
    const result = convertDuration(123, 'ms', 'ms')
    expect(result).toBe(123)
  })

  it('should convert complex durations (e.g., weeks to milliseconds)', () => {
    const result = convertDuration(1, 'w', 'ms')
    expect(result).toBe(604800000)
  })

  it('should convert milliseconds to weeks correctly', () => {
    const result = convertDuration(604800000, 'ms', 'w')
    expect(result).toBe(1)
  })

  it('should handle fractional conversions', () => {
    const result = convertDuration(1.5, 'd', 'h')
    expect(result).toBe(36)
  })
})
