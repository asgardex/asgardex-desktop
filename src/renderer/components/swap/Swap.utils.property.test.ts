/**
 * Property-based tests for Swap.utils pure functions.
 *
 * These complement the example-based tests in Swap.utils.test.ts.
 * fast-check generates arbitrary inputs to find edge cases that
 * hand-picked examples miss.
 */

import * as fc from 'fast-check'
import { AssetXRP } from '@xchainjs/xchain-ripple'
import { baseAmount } from '@xchainjs/xchain-util'

import { AssetBTC, AssetETH, AssetRuneNative, ADAAsset, SOLAsset } from '../../../shared/utils/asset'
import { ZERO_BASE_AMOUNT, AssetUSDCBSC } from '../../const'
import { eqBaseAmount } from '../../helpers/fp/eq'
import { getSwapLimit1e8, maxAmountToSwapMax1e8 } from './Swap.utils'

// ─── arbitraries ──────────────────────────────────────────────────────────────

// Safe non-negative integer — avoids JS precision loss above MAX_SAFE_INTEGER.
const arbNat = fc.nat({ max: 2 ** 32 - 1 })

// Alphanumeric strings with no `:` (memo delimiter) or `/` (streaming suffix
// delimiter), so they are safe to embed as individual memo parts without
// disturbing the colon-split index or the limit/quantity/interval parsing.
const arbPart = fc.stringMatching(/^[a-z0-9]{1,20}$/)

// BaseAmount at decimal-8 (the max1e8 format used throughout swap calculations).
const arbAmount8 = arbNat.map((n) => baseAmount(n, 8))

// Fee amounts can come in at any decimal (e.g. 18 for EVM gas).
const arbFeeAmount = fc
  .tuple(arbNat, fc.constantFrom(6, 8, 9, 18))
  .map(([n, d]) => baseAmount(n, d))

// ─── getSwapLimit1e8 ──────────────────────────────────────────────────────────
//
// Parses the swap limit from a THORChain memo.
// Format: `<op>:<asset>:<address>:<limit>[/<quantity>/<interval>]`
// The fourth colon-separated field is the limit; `/quantity/interval` is stripped.

describe('getSwapLimit1e8', () => {
  it('round-trip: valid memo with integer limit returns that limit', () => {
    fc.assert(
      fc.property(arbPart, arbPart, arbPart, arbNat, (p0, p1, p2, limit) => {
        const memo = `${p0}:${p1}:${p2}:${limit}`
        return eqBaseAmount.equals(getSwapLimit1e8(memo), baseAmount(limit))
      })
    )
  })

  it('streaming memo: interval suffix is stripped and limit is extracted correctly', () => {
    // THORChain streaming swap format: <limit>/<quantity>/<interval>
    // Extra slashes after the limit must not corrupt the returned amount.
    const arbPositive = fc.integer({ min: 1, max: 1000 })
    fc.assert(
      fc.property(arbPart, arbPart, arbPart, arbNat, arbPositive, arbPositive, (p0, p1, p2, limit, qty, interval) => {
        const memo = `${p0}:${p1}:${p2}:${limit}/${qty}/${interval}`
        return eqBaseAmount.equals(getSwapLimit1e8(memo), baseAmount(limit))
      })
    )
  })

  it('safety: result is never negative for any string input', () => {
    // This is the key safety invariant — the caller uses the limit to guard
    // minimum amounts and a negative result would undermine those checks.
    fc.assert(
      fc.property(fc.string(), (memo) => {
        const result = getSwapLimit1e8(memo)
        return result.gte(ZERO_BASE_AMOUNT)
      })
    )
  })

  it('short memos (fewer than 3 colons) always return ZERO', () => {
    // A string with k colons produces k+1 parts after split(':').
    // parts.length < 4 requires fewer than 3 colons.
    const arbShortMemo = fc.string().filter((s) => (s.match(/:/g) ?? []).length < 3)
    fc.assert(
      fc.property(arbShortMemo, (memo) => {
        return eqBaseAmount.equals(getSwapLimit1e8(memo), ZERO_BASE_AMOUNT)
      })
    )
  })

  it('negative limit always returns ZERO', () => {
    // The code guards `swapLimitNum < 0` — verify this holds for all generated negatives.
    const arbNegative = fc.integer({ min: -(2 ** 32 - 1), max: -1 })
    fc.assert(
      fc.property(arbPart, arbPart, arbPart, arbNegative, (p0, p1, p2, n) => {
        const memo = `${p0}:${p1}:${p2}:${n}`
        return eqBaseAmount.equals(getSwapLimit1e8(memo), ZERO_BASE_AMOUNT)
      })
    )
  })
})

// ─── maxAmountToSwapMax1e8 ────────────────────────────────────────────────────
//
// Returns the maximum spendable balance after deducting the inbound fee and any
// chain-level account reserve (XRP/ADA/SOL), clamped at zero.

describe('maxAmountToSwapMax1e8', () => {
  // Chain assets exercise the fee + reserve deduction path.
  const CHAIN_ASSETS = [AssetBTC, AssetETH, AssetRuneNative, ADAAsset, SOLAsset, AssetXRP] as const
  const arbChainAsset = fc.constantFrom(...CHAIN_ASSETS)

  it('result is never negative for any chain asset, balance, and fee', () => {
    // The most important safety invariant: sending a negative amount is impossible,
    // so the floor at ZERO_BASE_AMOUNT must hold for all inputs including the case
    // where fee + reserve exceeds the entire balance.
    fc.assert(
      fc.property(arbChainAsset, arbAmount8, arbFeeAmount, (asset, balance, fee) => {
        const result = maxAmountToSwapMax1e8({ asset, balanceAmountMax1e8: balance, feeAmount: fee })
        return result.gte(ZERO_BASE_AMOUNT)
      })
    )
  })

  it('result never exceeds the balance for chain assets', () => {
    fc.assert(
      fc.property(arbChainAsset, arbAmount8, arbFeeAmount, (asset, balance, fee) => {
        const result = maxAmountToSwapMax1e8({ asset, balanceAmountMax1e8: balance, feeAmount: fee })
        return result.lte(balance)
      })
    )
  })

  it('token (non-chain) assets are passed through unchanged — fee is never deducted', () => {
    // For token swaps the fee is paid in the native chain asset, not the token,
    // so deducting it from the token balance would be wrong.
    const TOKEN_ASSETS = [AssetUSDCBSC] as const
    const arbTokenAsset = fc.constantFrom(...TOKEN_ASSETS)
    fc.assert(
      fc.property(arbTokenAsset, arbAmount8, arbFeeAmount, (asset, balance, fee) => {
        const result = maxAmountToSwapMax1e8({ asset, balanceAmountMax1e8: balance, feeAmount: fee })
        return eqBaseAmount.equals(result, balance)
      })
    )
  })
})
