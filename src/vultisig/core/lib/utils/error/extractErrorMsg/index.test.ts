/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'

import { extractErrorMsg } from '.'

describe('extractErrorMsg', () => {
  it('should return the error message if the input is a string', () => {
    const errorMessage = 'An error occurred'
    expect(extractErrorMsg(errorMessage)).toBe(errorMessage)
  })

  it('should handle objects with a message property and extract recursively', () => {
    const errorObject = { message: 'Nested error message' }
    expect(extractErrorMsg(errorObject)).toBe('Nested error message')
  })

  it('should return an unknown error string if JSON.stringify fails', () => {
    const circularReference: Record<string, any> = {}
    circularReference['self'] = circularReference

    vi.spyOn(JSON, 'stringify').mockImplementation(() => {
      throw new Error('circular structure')
    })

    expect(extractErrorMsg(circularReference)).toBe('Unknown Error')
  })

  it('should return an unknown error string if the input is null', () => {
    expect(extractErrorMsg(null)).toBe('Unknown Error')
  })

  it('should return an unknown error string if the input is undefined', () => {
    expect(extractErrorMsg(undefined)).toBe('Unknown Error')
  })

  it('should handle unknown input types gracefully', () => {
    expect(extractErrorMsg(42)).toBe('42')
    expect(extractErrorMsg(true)).toBe('true')
    expect(extractErrorMsg(Symbol('test'))).toBe('Unknown Error')
  })
})
