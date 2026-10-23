import { Chain } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import { PoolAddress } from './midgardTypes'

const sameAddress = (left: string, right: string): boolean => left.trim().toLowerCase() === right.trim().toLowerCase()

/** Blank router means this chain has none. */
const routerAddress = (router: O.Option<string>): string | undefined => {
  if (O.isNone(router)) return undefined
  const trimmed = router.value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const routersMatch = (left: O.Option<string>, right: O.Option<string>): boolean => {
  const submitted = routerAddress(left)
  const current = routerAddress(right)
  if (submitted === undefined || current === undefined) return submitted === current
  return sameAddress(submitted, current)
}

/**
 * Compare the address a swap will pay with the fresh inbound row.
 * Vault and router are checked separately. Halt, protocol, and fee fields are ignored:
 * the halt check already ran against the fresh row.
 * Returns null when both addresses match.
 */
export const poolInboundMismatch = (
  submitted: PoolAddress,
  current: O.Option<PoolAddress>,
  chain: Chain
): string | null => {
  if (O.isNone(current)) {
    return `No current ${chain} inbound address. Refresh and try again.`
  }

  const latest = current.value
  const vaultMatches = sameAddress(submitted.address, latest.address)
  const routerMatches = routersMatch(submitted.router, latest.router)
  if (vaultMatches && routerMatches) return null

  const parts: string[] = []
  if (!vaultMatches) {
    parts.push(
      `Vault address ${submitted.address} does not match the current ${chain} vault address (${latest.address})`
    )
  }
  if (!routerMatches) {
    const submittedRouter = routerAddress(submitted.router) ?? 'none'
    const currentRouter = routerAddress(latest.router) ?? 'none'
    parts.push(
      `Router address ${submittedRouter} does not match the current ${chain} router address (${currentRouter})`
    )
  }
  return `${parts.join('. ')}. Refresh and try again.`
}
