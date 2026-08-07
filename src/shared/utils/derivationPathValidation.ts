import { Network } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'

import { getChainDerivationPath } from './derivationPath'

// A single BIP32 path segment: digits, optionally hardened with a trailing `'`.
// Checked per-segment (not one big regex) to stay linear / ReDoS-safe.
const SEGMENT_RE = /^\d+'?$/
// Hardened offset boundary — each numeric segment must fit a uint31.
const MAX_PATH_SEGMENT = 2 ** 31 - 1

export type DerivationPathValidation = { valid: boolean; error?: 'empty' | 'format' | 'range' }

/** i18n-ready advisory returned by `warnDerivationPath` (format with `intl.formatMessage`). */
export type DerivationPathWarning = {
  id:
    | 'settings.wallet.hd.path.warn.testnetNormally'
    | 'settings.wallet.hd.path.warn.testnetCoinOnNetwork'
    | 'settings.wallet.hd.path.warn.coinTypeMismatch'
  values: Record<string, string>
}

/**
 * Structural BIP32 validation. Blocking: an invalid path must never reach the
 * client layer. Accepts e.g. `m/44'/60'/0'/0/0`.
 */
export const validateDerivationPath = (path: string): DerivationPathValidation => {
  const p = path.trim()
  if (p.length === 0) return { valid: false, error: 'empty' }
  const parts = p.split('/')
  if (parts[0] !== 'm' || parts.length < 2) return { valid: false, error: 'format' }
  const segs = parts.slice(1)
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (!SEGMENT_RE.test(seg)) return { valid: false, error: 'format' }
    // Explicit suffix strip (avoid String#replace — Semgrep incomplete-sanitization)
    const numericSegment = seg.endsWith("'") ? seg.slice(0, -1) : seg
    const n = Number(numericSegment)
    if (!Number.isInteger(n) || n < 0 || n > MAX_PATH_SEGMENT) return { valid: false, error: 'range' }
    // Final segment must be non-hardened — clients derive walletIndex as a plain index
    if (i === segs.length - 1 && seg.endsWith("'")) return { valid: false, error: 'format' }
  }
  return { valid: true }
}

/** Second path segment (coin_type), e.g. `m/44'/60'/…` → `"60'"`; `undefined` if absent. */
const coinTypeOf = (path: string): string | undefined => path.trim().split('/').slice(1)[1]

/**
 * Non-blocking advisory. Flags a custom path whose coin-type looks unusual for
 * the chain or is mismatched with the current network (testnet uses coin-type
 * `1'`). Returns an i18n message descriptor, or `undefined` when nothing looks off.
 */
export const warnDerivationPath = (path: string, chain: Chain, network: Network): DerivationPathWarning | undefined => {
  if (!validateDerivationPath(path).valid) return undefined
  const coinType = coinTypeOf(path)
  if (!coinType) return undefined

  if (network === Network.Testnet && coinType !== "1'") {
    return {
      id: 'settings.wallet.hd.path.warn.testnetNormally',
      values: { coinType }
    }
  }
  if (network !== Network.Testnet && coinType === "1'") {
    return {
      id: 'settings.wallet.hd.path.warn.testnetCoinOnNetwork',
      values: { network: String(network) }
    }
  }
  const expected = coinTypeOf(getChainDerivationPath(chain, 0, 0, network).path)
  if (expected && coinType !== expected) {
    return {
      id: 'settings.wallet.hd.path.warn.coinTypeMismatch',
      values: { coinType, chain: String(chain), expected }
    }
  }
  return undefined
}
