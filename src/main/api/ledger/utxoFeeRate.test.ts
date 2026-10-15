import { describe, expect, it, vi } from 'vitest'

import { resolveLedgerFeeRate } from './utxoFeeRate'

vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

describe('resolveLedgerFeeRate', () => {
  it('uses the passed rate and does not hit the provider', async () => {
    const fetch = vi.fn().mockResolvedValue(1)
    expect(await resolveLedgerFeeRate('BTC', 12, fetch)).toBe(12)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([undefined, 0, -1, NaN, Infinity])('falls back to the provider rate for %s', async (bad) => {
    const fetch = vi.fn().mockResolvedValue(7)
    expect(await resolveLedgerFeeRate('BCH', bad as number | undefined, fetch)).toBe(7)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
