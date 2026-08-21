/**
 * THOR/MAYA quote errors that mean "approve the router, then retry" — not a hard
 * route failure. Kept in one place so quote selection and Swap UI stay in sync.
 */
export const isRouterApprovalError = (error: string): boolean =>
  error.toLowerCase().includes('router has not been approved to spend this amount')

export const quoteBlockedOnlyByApproval = (errors: string[]): boolean =>
  errors.length > 0 && errors.every(isRouterApprovalError)
