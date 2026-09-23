/**
 * THOR/MAYA quote errors that mean "approve the router, then retry" — not a hard
 * route failure. Kept in one place so quote selection and Swap UI stay in sync.
 */
export const isRouterApprovalError = (error: string): boolean => {
  const lower = error.toLowerCase()
  return (
    lower.includes('router has not been approved to spend this amount') ||
    // Broader variants seen from thornode / wrappers
    (lower.includes('not been approved') && lower.includes('router')) ||
    lower.includes('insufficient allowance')
  )
}

/** True when every error is an approval block (no other hard failures). */
export const quoteBlockedOnlyByApproval = (errors: string[]): boolean =>
  errors.length > 0 && errors.every(isRouterApprovalError)

/**
 * True when approval is among the blockers. Used to keep a quote selected so the
 * Approve CTA can render even if THOR also attached another soft error.
 */
export const quoteNeedsRouterApproval = (errors: string[]): boolean => errors.some(isRouterApprovalError)
