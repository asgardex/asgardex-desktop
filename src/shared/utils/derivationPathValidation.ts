import { Network } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'

import { getChainDerivationPath } from './derivationPath'

// A single BIP32 path segment: digits, optionally hardened with a trailing `'`.
// Checked per-segment (not one big regex) to stay linear / ReDoS-safe.
const SEGMENT_RE = /^\d+'?$/
// Hardened offset boundary — each numeric segment must fit a uint31.
const MAX_PATH_SEGMENT = 2 ** 31 - 1

export type DerivationPathValidation = { valid: boolean; error?: 'empty' | 'format' | 'range' }

/**
 * Structural BIP32 validation. Blocking: an invalid path must never reach the
 * client layer. Accepts e.g. `m/44'/60'/0'/0/0`.
 */
export const validateDerivationPath = (path: string): DerivationPathValidation => {
  const p = path.trim()
  if (p.length === 0) return { valid: false, error: 'empty' }
  const parts = p.split('/')
  if (parts[0] !== 'm' || parts.length < 2) return { valid: false, error: 'format' }
  for (const seg of parts.slice(1)) {
    if (!SEGMENT_RE.test(seg)) return { valid: false, error: 'format' }
    const n = Number(seg.replace("'", ''))
    if (!Number.isInteger(n) || n < 0 || n > MAX_PATH_SEGMENT) return { valid: false, error: 'range' }
  }
  return { valid: true }
}

/** Second path segment (coin_type), e.g. `m/44'/60'/…` → `"60'"`; `undefined` if absent. */
const coinTypeOf = (path: string): string | undefined => path.trim().split('/').slice(1)[1]

/**
 * Non-blocking advisory. Flags a custom path whose coin-type looks unusual for
 * the chain or is mismatched with the current network (testnet uses coin-type
 * `1'`). Returns a human-readable warning, or `undefined` when nothing looks off.
 */
export const warnDerivationPath = (path: string, chain: Chain, network: Network): string | undefined => {
  if (!validateDerivationPath(path).valid) return undefined
  const coinType = coinTypeOf(path)
  if (!coinType) return undefined

  if (network === Network.Testnet && coinType !== "1'") {
    return `Path uses coin-type ${coinType} but testnet normally uses 1'`
  }
  if (network !== Network.Testnet && coinType === "1'") {
    return `Path uses the testnet coin-type (1') on ${network}`
  }
  const expected = coinTypeOf(getChainDerivationPath(chain, 0, 0, network).path)
  if (expected && coinType !== expected) {
    return `Coin-type ${coinType} does not match ${chain}'s standard (${expected}); funds may be unreachable in other wallets`
  }
  return undefined
}
