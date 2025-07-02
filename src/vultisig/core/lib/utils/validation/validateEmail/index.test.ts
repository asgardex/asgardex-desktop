import { describe, expect, it } from 'vitest'

import { validateEmail } from '.'

describe('validateEmail', () => {
  it('should return undefined for a valid email', () => {
    expect(validateEmail('test@example.com')).toBeUndefined()
    expect(validateEmail('user+alias@domain.co')).toBeUndefined()
    expect(validateEmail('user.name@sub.domain.com')).toBeUndefined()
  })

  it('should return an error message for an invalid email', () => {
    expect(validateEmail('invalid-email')).toBe('Please enter a valid email address')
    expect(validateEmail('user@')).toBe('Please enter a valid email address')
    expect(validateEmail('@domain.com')).toBe('Please enter a valid email address')
    expect(validateEmail('user@domain@domain.com')).toBe('Please enter a valid email address')
    expect(validateEmail('user@domain.')).toBe('Please enter a valid email address')
  })

  it('should return an error message for an empty string', () => {
    expect(validateEmail('')).toBe('Please enter a valid email address')
  })

  it('should handle edge cases for special characters', () => {
    expect(validateEmail("user!#$%&'*+/=?^_`{|}~-@domain.com")).toBeUndefined()
    expect(validateEmail('user@domain..com')).toBe('Please enter a valid email address') // Invalid due to double dot
  })

  it('should return an error message for spaces in email', () => {
    expect(validateEmail('user @domain.com')).toBe('Please enter a valid email address')
    expect(validateEmail('user@domain. com')).toBe('Please enter a valid email address')
  })

  it('should handle numeric domains and local parts', () => {
    expect(validateEmail('12345@67890.com')).toBeUndefined()
    expect(validateEmail('user@12345.67890')).toBeUndefined()
  })
})
