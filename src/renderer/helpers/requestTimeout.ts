/** Max time for a node request that halt decisions depend on (`mimir`, `lastblock`) */
export const HALT_REQUEST_TIMEOUT_MS = 12 * 1000

/**
 * Rejects if `promise` does not settle in `ms`. A node that accepts the connection but never answers
 * would otherwise leave the request pending forever.
 */
export const withTimeout = <T>(promise: Promise<T>, ms = HALT_REQUEST_TIMEOUT_MS, label = 'Request'): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
