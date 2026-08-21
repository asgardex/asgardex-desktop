import { describe, expect, it } from 'vitest'

import { isRouterApprovalError, quoteBlockedOnlyByApproval } from './evmApprovalHelper'

describe('evmApprovalHelper', () => {
  it('detects THOR router approval errors', () => {
    expect(isRouterApprovalError('router has not been approved to spend this amount')).toBe(true)
    expect(
      isRouterApprovalError('Error getting Thorchain quotes: router has not been approved to spend this amount')
    ).toBe(true)
    expect(isRouterApprovalError('insufficient funds')).toBe(false)
  })

  it('treats approval-only error lists as approval-blocked quotes', () => {
    expect(quoteBlockedOnlyByApproval(['router has not been approved to spend this amount'])).toBe(true)
    expect(
      quoteBlockedOnlyByApproval([
        'router has not been approved to spend this amount',
        'Router has not been approved to spend this amount'
      ])
    ).toBe(true)
    expect(
      quoteBlockedOnlyByApproval(['router has not been approved to spend this amount', 'pool does not exist'])
    ).toBe(false)
    expect(quoteBlockedOnlyByApproval([])).toBe(false)
  })
})
