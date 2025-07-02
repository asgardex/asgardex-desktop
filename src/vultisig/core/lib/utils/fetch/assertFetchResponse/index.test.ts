import { describe, expect, it, vi } from 'vitest'

import { extractErrorMsg } from '../../error/extractErrorMsg'
import { asyncFallbackChain } from '../../promise/asyncFallbackChain'
import { assertFetchResponse } from '.'

vi.mock('../../error/extractErrorMsg', () => ({
  extractErrorMsg: vi.fn()
}))

vi.mock('../../promise/asyncFallbackChain', () => ({
  asyncFallbackChain: vi.fn()
}))

describe('assertFetchResponse', () => {
  it('should not throw if the response is OK', async () => {
    const response = { ok: true } as Response

    await expect(assertFetchResponse(response)).resolves.not.toThrow()
  })

  it('should throw an error with the extracted message if the response is not OK', async () => {
    const response = {
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'API Error' }),
      text: vi.fn().mockResolvedValue('Raw error text')
    } as unknown as Response

    vi.mocked(asyncFallbackChain).mockResolvedValue({ error: 'API Error' })
    vi.mocked(extractErrorMsg).mockReturnValue('API Error')

    await expect(assertFetchResponse(response)).rejects.toThrow('API Error')

    expect(asyncFallbackChain).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), expect.any(Function))
    expect(extractErrorMsg).toHaveBeenCalledWith({ error: 'API Error' })
  })

  it('should fall back to text if JSON parsing fails', async () => {
    const response = {
      ok: false,
      json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
      text: vi.fn().mockResolvedValue('Raw error text')
    } as unknown as Response

    vi.mocked(asyncFallbackChain).mockResolvedValue('Raw error text')
    vi.mocked(extractErrorMsg).mockReturnValue('Parsed text error')

    await expect(assertFetchResponse(response)).rejects.toThrow('Parsed text error')

    expect(asyncFallbackChain).toHaveBeenCalled()
    expect(extractErrorMsg).toHaveBeenCalledWith('Raw error text')
  })

  it('should fall back to "Unknown error" if both JSON and text fail', async () => {
    const response = {
      ok: false,
      json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
      text: vi.fn().mockRejectedValue(new Error('Text parse error'))
    } as unknown as Response

    vi.mocked(asyncFallbackChain).mockResolvedValue('Unknown error')
    vi.mocked(extractErrorMsg).mockReturnValue('Unknown error parsed')

    await expect(assertFetchResponse(response)).rejects.toThrow('Unknown error parsed')

    expect(asyncFallbackChain).toHaveBeenCalled()
    expect(extractErrorMsg).toHaveBeenCalledWith('Unknown error')
  })
})
