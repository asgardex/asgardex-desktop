import { getChainId } from '@xchainjs/xchain-mayachain'

const pending = new Map<string, Promise<string>>()

/**
 * One node check (`node_info`) for keystore + read-only client started in the same turn (unlock, rebuild).
 * Only a pending request is shared, never a failure: a caller that joined a request that fails sends its own,
 * and a failed or finished request is dropped, so later callers always ask the node again.
 */
export const getChainIdShared = (url: string): Promise<string> => {
  const shared = pending.get(url)
  if (shared) return shared.catch(() => getChainId(url))
  const request = getChainId(url)
  pending.set(url, request)
  const drop = () => {
    if (pending.get(url) === request) pending.delete(url)
  }
  setTimeout(drop, 0)
  request.catch(drop)
  return request
}
