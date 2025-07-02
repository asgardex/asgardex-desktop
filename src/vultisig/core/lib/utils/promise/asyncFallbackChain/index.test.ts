import { describe, expect, it, vi } from 'vitest'

import { asyncFallbackChain } from '.'

describe('asyncFallbackChain', () => {
  it('should return the result of the first function if it resolves successfully', async () => {
    const mockFunc1 = vi.fn().mockResolvedValue('first')
    const mockFunc2 = vi.fn().mockResolvedValue('second')

    const result = await asyncFallbackChain(mockFunc1, mockFunc2)

    expect(result).toBe('first')
    expect(mockFunc1).toHaveBeenCalled()
    expect(mockFunc2).not.toHaveBeenCalled()
  })

  it('should call the second function if the first one rejects', async () => {
    const mockFunc1 = vi.fn().mockRejectedValue(new Error('first failure'))
    const mockFunc2 = vi.fn().mockResolvedValue('second')

    const result = await asyncFallbackChain(mockFunc1, mockFunc2)

    expect(result).toBe('second')
    expect(mockFunc1).toHaveBeenCalled()
    expect(mockFunc2).toHaveBeenCalled()
  })

  it('should throw an error if all functions reject', async () => {
    const mockFunc1 = vi.fn().mockRejectedValue(new Error('first failure'))
    const mockFunc2 = vi.fn().mockRejectedValue(new Error('second failure'))

    await expect(asyncFallbackChain(mockFunc1, mockFunc2)).rejects.toThrow('second failure')

    expect(mockFunc1).toHaveBeenCalled()
    expect(mockFunc2).toHaveBeenCalled()
  })

  it('should handle a single function that resolves successfully', async () => {
    const mockFunc1 = vi.fn().mockResolvedValue('only')

    const result = await asyncFallbackChain(mockFunc1)

    expect(result).toBe('only')
    expect(mockFunc1).toHaveBeenCalled()
  })

  it('should handle a single function that rejects', async () => {
    const mockFunc1 = vi.fn().mockRejectedValue(new Error('failure'))

    await expect(asyncFallbackChain(mockFunc1)).rejects.toThrow('failure')

    expect(mockFunc1).toHaveBeenCalled()
  })

  it('should call functions in order until one resolves', async () => {
    const mockFunc1 = vi.fn().mockRejectedValue(new Error('failure1'))
    const mockFunc2 = vi.fn().mockRejectedValue(new Error('failure2'))
    const mockFunc3 = vi.fn().mockResolvedValue('success')

    const result = await asyncFallbackChain(mockFunc1, mockFunc2, mockFunc3)

    expect(result).toBe('success')
    expect(mockFunc1).toHaveBeenCalled()
    expect(mockFunc2).toHaveBeenCalled()
    expect(mockFunc3).toHaveBeenCalled()
  })
})
