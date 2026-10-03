/**
 * Property-based tests for memoHelper pure functions.
 *
 * These exercise structural invariants that example-based tests miss:
 *   - applyStreamingToMemo preserves the base limit on re-application
 *   - applyStreamingToMemo + getSwapLimit1e8 round-trip is consistent
 *   - parseSwapMemoDestination round-trips through getSwapMemo
 *   - swapDestinationMatches is reflexive and symmetric
 *   - swapDestinationMatches is case-insensitive for EVM 0x addresses only
 */

import * as fc from 'fast-check'
import { option as O } from 'fp-ts'

import { AssetRuneNative } from '../../shared/utils/asset'
import { eqBaseAmount } from './fp/eq'
import { getSwapLimit1e8 } from '../components/swap/Swap.utils'
import { applyStreamingToMemo, getSwapMemo, parseSwapMemoDestination, swapDestinationMatches } from './memoHelper'

// ─── arbitraries ──────────────────────────────────────────────────────────────

// Memo parts: alphanumeric, no ':' (delimiter) or '/' (streaming suffix), so
// they are safe as individual colon-separated fields.
const arbPart = fc.stringMatching(/^[a-z0-9]{1,20}$/)

// Non-negative integer limit — safe to embed in position 3 of a memo.
const arbLimit = fc.nat({ max: 2 ** 32 - 1 })

// Streaming interval/quantity: small naturals cover the important edge cases
// (0 = rapid mode, 1 = single-swap, >1 = true streaming).
const arbStreamParam = fc.nat({ max: 1000 })

// A well-formed THORChain swap-quote memo: `<op>:<asset>:<address>:<limit>`.
// This is the format the THORNode API returns before streaming injection.
const arbQuoteMemo = fc.tuple(arbPart, arbPart, arbPart, arbLimit).map(
  ([op, asset, addr, limit]) => `${op}:${asset}:${addr}:${limit}`
)

// Addresses without ':' — they survive the colon-split round-trip intact.
const arbAddress = fc.stringMatching(/^[a-zA-Z0-9]{10,40}$/)

// EVM-style addresses: '0x' + 40 lowercase hex chars.
const arbEvmHex = fc.stringMatching(/^[0-9a-f]{40}$/)
const arbEvmAddress = arbEvmHex.map((hex) => `0x${hex}`)

// Non-EVM addresses: start with a lowercase letter (never '0x…'), contain only
// lowercase letters so toUpperCase() produces a strictly different string.
const arbNonEvmAddress = fc.stringMatching(/^[a-z]{5,20}$/)

// ─── applyStreamingToMemo ─────────────────────────────────────────────────────
//
// Modifies position 3 (the limit field) of a colon-split memo by appending
// `/interval/qty`.  The base limit (before any slash) must never change.

describe('applyStreamingToMemo', () => {
  it('applying streaming once: getSwapLimit1e8 is unchanged', () => {
    // applyStreamingToMemo appends /interval/qty to the limit field.
    // getSwapLimit1e8 strips everything after '/' before parsing, so both
    // the original memo and the streaming-injected version must yield the
    // same limit.
    fc.assert(
      fc.property(arbQuoteMemo, arbStreamParam, arbStreamParam, (memo, interval, qty) => {
        const streamed = applyStreamingToMemo(memo, interval, qty)
        return eqBaseAmount.equals(getSwapLimit1e8(streamed), getSwapLimit1e8(memo))
      })
    )
  })

  it('applying streaming twice: second application replaces first, limit still unchanged', () => {
    // applyStreamingToMemo takes the part before the first '/' as the base
    // limit, so re-applying strips the first /interval/qty before injecting
    // the new one.  The base limit must survive both applications intact.
    fc.assert(
      fc.property(arbQuoteMemo, arbStreamParam, arbStreamParam, arbStreamParam, arbStreamParam, (memo, i1, q1, i2, q2) => {
        const once = applyStreamingToMemo(memo, i1, q1)
        const twice = applyStreamingToMemo(once, i2, q2)
        return eqBaseAmount.equals(getSwapLimit1e8(twice), getSwapLimit1e8(memo))
      })
    )
  })

  it('streaming params appear in the output memo', () => {
    // Verify the injected values are present — guards against an
    // implementation that silently drops them.
    fc.assert(
      fc.property(arbQuoteMemo, arbStreamParam, arbStreamParam, (memo, interval, qty) => {
        const streamed = applyStreamingToMemo(memo, interval, qty)
        return streamed.includes(`/${interval}/${qty}`)
      })
    )
  })
})

// ─── parseSwapMemoDestination round-trip ──────────────────────────────────────
//
// getSwapMemo produces `=:ASSET:ADDRESS:…`; parseSwapMemoDestination extracts
// position 2.  For any colon-free address, parsing a freshly built memo must
// recover the original address.

describe('parseSwapMemoDestination ∘ getSwapMemo round-trip', () => {
  it('extracts the original address from a getSwapMemo-produced memo', () => {
    fc.assert(
      fc.property(arbAddress, arbStreamParam, arbStreamParam, (address, interval, qty) => {
        const memo = getSwapMemo({
          targetAsset: AssetRuneNative,
          targetAddress: address,
          toleranceBps: undefined,
          streamingInterval: interval,
          streamingQuantity: qty,
          affiliateName: undefined,
          affiliateBps: undefined
        })
        const result = parseSwapMemoDestination(memo)
        return O.isSome(result) && result.value === address
      })
    )
  })

  it('toleranceBps does not affect address extraction', () => {
    // When toleranceBps is defined, it inserts an extra field at position 3,
    // pushing streaming to position 4.  Address remains at position 2 regardless.
    const arbBps = fc.nat({ max: 10000 })
    fc.assert(
      fc.property(arbAddress, arbBps, arbStreamParam, arbStreamParam, (address, bps, interval, qty) => {
        const memo = getSwapMemo({
          targetAsset: AssetRuneNative,
          targetAddress: address,
          toleranceBps: bps,
          streamingInterval: interval,
          streamingQuantity: qty,
          affiliateName: undefined,
          affiliateBps: undefined
        })
        const result = parseSwapMemoDestination(memo)
        return O.isSome(result) && result.value === address
      })
    )
  })

  it('returns None for memos that are not swap memos', () => {
    // Any memo whose first field is neither '=' nor 'swap' must not yield an address.
    // A BOND / ADD / WITHDRAW memo must not accidentally leak an address.
    const arbNonSwapOp = fc.constantFrom('BOND', 'ADD', '+', '-', 'WITHDRAW', 'LEAVE')
    fc.assert(
      fc.property(arbNonSwapOp, arbPart, arbPart, (op, asset, addr) => {
        const memo = `${op}:${asset}:${addr}:extra`
        return O.isNone(parseSwapMemoDestination(memo))
      })
    )
  })
})

// ─── swapDestinationMatches ───────────────────────────────────────────────────
//
// Reflexivity, symmetry, and the EVM/non-EVM case-sensitivity split.

describe('swapDestinationMatches', () => {
  it('reflexivity: any address matches itself', () => {
    fc.assert(
      fc.property(fc.string(), (addr) => {
        return swapDestinationMatches(addr, addr)
      })
    )
  })

  it('symmetry: a matches b iff b matches a', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        return swapDestinationMatches(a, b) === swapDestinationMatches(b, a)
      })
    )
  })

  it('EVM addresses: matching is case-insensitive', () => {
    // Both lowercase and uppercase 0x-prefixed 40-char hex addresses must match
    // each other — checksum casing must not cause a false mismatch.
    fc.assert(
      fc.property(arbEvmHex, (hex) => {
        const lower = `0x${hex}`
        const upper = `0x${hex.toUpperCase()}`
        return swapDestinationMatches(lower, upper)
      })
    )
  })

  it('non-EVM addresses: matching is case-sensitive', () => {
    // Two addresses that differ only in case must NOT match for non-EVM formats
    // (Base58-based chains like BTC/LTC/DOGE have case-sensitive addresses).
    fc.assert(
      fc.property(arbNonEvmAddress, (addr) => {
        const upper = addr.toUpperCase()
        // All-lowercase letter strings always have a different uppercase form,
        // so these two are always distinct — and must not match.
        return !swapDestinationMatches(addr, upper)
      })
    )
  })

  it('EVM whitespace trimming: leading/trailing spaces are ignored', () => {
    fc.assert(
      fc.property(arbEvmAddress, (addr) => {
        return swapDestinationMatches(`  ${addr}  `, addr)
      })
    )
  })
})
