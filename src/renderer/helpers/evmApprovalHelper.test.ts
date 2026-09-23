import { describe, expect, it } from 'vitest'

import { isRouterApprovalError, quoteBlockedOnlyByApproval, quoteNeedsRouterApproval } from './evmApprovalHelper'

describe('evmApprovalHelper', () => {
  it('detects THOR and MAYA router approval errors', () => {
    expect(isRouterApprovalError('Thorchain router has not been approved to spend this amount')).toBe(true)
    expect(isRouterApprovalError('Maya router has not been approved to spend this amount')).toBe(true)
    expect(
      isRouterApprovalError('Error getting Thorchain quotes: router has not been approved to spend this amount')
    ).toBe(true)
    expect(isRouterApprovalError('insufficient allowance')).toBe(true)
    expect(isRouterApprovalError('insufficient funds')).toBe(false)
  })

  it('quoteBlockedOnlyByApproval requires every error to be approval', () => {
    expect(quoteBlockedOnlyByApproval(['Thorchain router has not been approved to spend this amount'])).toBe(true)
    expect(
      quoteBlockedOnlyByApproval(['Thorchain router has not been approved to spend this amount', 'pool does not exist'])
    ).toBe(false)
    expect(quoteBlockedOnlyByApproval([])).toBe(false)
  })

  it('quoteNeedsRouterApproval is true if any error is approval (USDC mixed errors)', () => {
    expect(
      quoteNeedsRouterApproval([
        'Thorchain router has not been approved to spend this amount',
        'amount in: 1 is less than recommended Min Amount: 2'
      ])
    ).toBe(true)
    expect(quoteNeedsRouterApproval(['pool does not exist'])).toBe(false)
  })
})
