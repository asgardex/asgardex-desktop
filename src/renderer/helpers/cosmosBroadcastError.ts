/**
 * CosmJS `broadcastTx` submits via broadcastTxSync, then polls getTx until inclusion
 * (default 60s). If the node accepted the tx but indexing/RPC lags, it throws
 * TimeoutError with the tx hash already known — that is NOT a failed send.
 */

const SUBMITTED_BUT_NOT_FOUND_RE = /transaction with id\s+([0-9a-f]+)\s+was submitted but was not yet found/i

const LOOKS_LIKE_BROADCAST_TIMEOUT_RE =
  /broadcast(ing)?.*(timed out|timeout)|timed out.*(broadcast|inclusion|block)|not yet found on the chain|was submitted but was not yet found/i

export type BroadcastTimeoutRecovery = {
  txHash: string
  /** Original error message (for logging). */
  message: string
}

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

const txIdFromError = (error: unknown): string | undefined => {
  if (error && typeof error === 'object' && 'txId' in error) {
    const txId = (error as { txId?: unknown }).txId
    if (typeof txId === 'string' && txId.trim()) return txId.trim()
  }
  return undefined
}

/**
 * If `error` means "tx was submitted, confirmation poll timed out", return the hash.
 * Otherwise return undefined so callers can fail closed.
 */
export const recoverTxHashFromBroadcastTimeout = (error: unknown): BroadcastTimeoutRecovery | undefined => {
  const message = errorMessage(error)
  const txHash = (txIdFromError(error) || SUBMITTED_BUT_NOT_FOUND_RE.exec(message)?.[1] || '').trim()
  if (!txHash) return undefined

  const isTimeoutErrorName =
    !!error && typeof error === 'object' && (error as { name?: string }).name === 'TimeoutError'

  if (!isTimeoutErrorName && !LOOKS_LIKE_BROADCAST_TIMEOUT_RE.test(message)) return undefined

  return { txHash, message }
}
