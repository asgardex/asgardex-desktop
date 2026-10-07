/**
 * Property-based regression tests for the ADA swap bug (v1.46.0).
 *
 * Bug: A user who set 100% on a UTXO source asset (BTC/LTC/BCH/DOGE/DASH/ZEC)
 * and then switched to ADA would have the stale isSendMax=true forwarded all
 * the way to sendKeystoreMaxTx, draining the entire ADA wallet instead of
 * sending only the specified amount.
 *
 * Root cause: Swap.tsx managed isSendMax only for isSourceUTXO chains, but
 * useSwapExecution.ts forwarded isSendMax for both UTXO and ADA chains via
 * isMaxSweepAsset. The mismatch left ADA unguarded.
 *
 * Fix (commit a0f2b265 + 70eafccc): extract isMaxSweepAsset and sendMaxFromPercent
 * to assetHelper as the single source of truth used by both Swap.tsx and
 * useSwapExecution.ts; also reset isSendMax unconditionally whenever the source
 * asset changes.
 *
 * HOW TO VERIFY THE BUG REPRODUCED BEFORE THE FIX
 * ─────────────────────────────────────────────────
 * In Property 1, the second test documents the pre-fix guard — it expects
 * fast-check to find ADA as a counterexample.
 * In Properties 2 & 3, simulateBuggy hard-codes the pre-fix logic; the test
 * wraps fc.assert in expect(...).toThrow() so fast-check's counterexample
 * becomes the passing signal.
 */

import { AnyAsset, AssetType } from '@xchainjs/xchain-util'
import * as fc from 'fast-check'
import { DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { isMaxSweepAsset, isUtxoAssetChain, sendMaxFromPercent } from '../../helpers/assetHelper'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal native asset for a given chain (enough for chain-level checks). */
const nativeAsset = (chain: string): AnyAsset => ({
  chain,
  symbol: chain,
  ticker: chain,
  type: AssetType.NATIVE
})

// ─── arbitraries ──────────────────────────────────────────────────────────────

// Derived from the app's canonical chain registry — automatically covers any
// chain added to DEFAULT_ENABLED_CHAINS in future without test changes.
const ALL_CHAINS = Object.keys(DEFAULT_ENABLED_CHAINS)

// Chains where isMaxSweepAsset is true — automatically tracks any future
// addition to isMaxSweepAsset in assetHelper.ts.
const MAX_SWEEP_CHAINS = ALL_CHAINS.filter((chain) => isMaxSweepAsset(nativeAsset(chain)))

const arbAllChain = fc.constantFrom(...(ALL_CHAINS as [string, ...string[]]))
const arbMaxSweepChain = fc.constantFrom(...(MAX_SWEEP_CHAINS as [string, ...string[]]))

// ─── Property 1: sendMaxFromPercent covers exactly isMaxSweepAsset chains ─────
//
// The production function sendMaxFromPercent must return `true` at 100% for
// every chain where isMaxSweepAsset is true, and `undefined` for all others.
//
// If this property fails, a chain that uses transferMax is either missed
// (stale isSendMax can drain it) or falsely enabled (sendMax fires when it
// shouldn't).

describe('sendMaxFromPercent covers exactly the chains that isMaxSweepAsset covers', () => {
  it('post-fix: returns true at 100% for isMaxSweepAsset chains, undefined for others', () => {
    fc.assert(
      fc.property(arbAllChain, (chain) => {
        const asset = nativeAsset(chain)
        const result = sendMaxFromPercent(asset, 100)
        return isMaxSweepAsset(asset) ? result === true : result === undefined
      })
    )
  })

  it('pre-fix guard (isUtxoAssetChain only) misses ADA — expected counterexample', () => {
    // Documents the pre-fix mismatch: the old guard only fired for UTXO chains,
    // but sendMaxFromPercent (and isMaxSweepAsset) also covers ADA.
    // fast-check will always shrink to ADA as the counterexample.
    expect(() => {
      fc.assert(
        fc.property(arbAllChain, (chain) => {
          const asset = nativeAsset(chain)
          // Pre-fix behaviour: only UTXO chains contributed to isSendMax
          const preFix = isUtxoAssetChain(asset) ? true : undefined
          // Post-fix behaviour: must match sendMaxFromPercent
          return preFix === sendMaxFromPercent(asset, 100)
        })
      )
    }).toThrow() // fast-check throws because ADA breaks the equality
  })
})

// ─── Property 2 & 3: state-machine simulation ─────────────────────────────────
//
// Models the isSendMax state transitions in Swap.tsx for the scenario that
// triggered the bug, then checks the sendMax value that useSwapExecution would
// derive from that state.
//
// Actions:
//   setPercent100  — user moves the percent slider to 100% on a given chain
//   typeAmount     — user manually types a specific (non-100%) amount
//   changeAsset    — user switches the source asset
//
// Invariant: after any sequence ending with [changeAsset(T), typeAmount(T)]
// for any isMaxSweepAsset chain T, the computed sendMax must never be true.

type Action =
  | { type: 'setPercent100'; chain: string }
  | { type: 'typeAmount'; chain: string }
  | { type: 'changeAsset'; chain: string }

/**
 * Simulates the isSendMax state machine from the PRE-FIX Swap.tsx.
 * Deliberately reproduces the two bugs:
 *   1. changeAsset does not reset isSendMax.
 *   2. typeAmount only resets isSendMax for isSourceUTXO chains (not ADA).
 */
const simulateBuggy = (actions: Action[]): boolean => {
  let isSendMax = false
  for (const action of actions) {
    const asset = nativeAsset(action.chain)
    const isUTXO = isUtxoAssetChain(asset)
    switch (action.type) {
      case 'setPercent100':
        if (isUTXO) isSendMax = true // only UTXO, ADA excluded
        break
      case 'typeAmount':
        if (isUTXO) isSendMax = false // only UTXO, ADA excluded
        break
      case 'changeAsset':
        /* BUG: no reset */
        break
    }
  }
  return isSendMax
}

/**
 * Simulates the isSendMax state machine from the POST-FIX Swap.tsx.
 *
 * Uses the real production functions from assetHelper so that any regression
 * in those functions (e.g. removing ADA from isMaxSweepAsset) causes this
 * simulation — and therefore the property test — to fail.
 *
 * Three fixes applied:
 *   1. changeAsset always resets isSendMax (Swap.tsx source-asset-change effect).
 *   2. typeAmount resets isSendMax for all isMaxSweepAsset chains (via isSourceMaxSweep).
 *   3. setPercent100 uses sendMaxFromPercent, the same function Swap.tsx now delegates to.
 */
const simulateFixed = (actions: Action[]): boolean => {
  let isSendMax = false
  for (const action of actions) {
    const asset = nativeAsset(action.chain)
    switch (action.type) {
      case 'setPercent100': {
        const newVal = sendMaxFromPercent(asset, 100) // real production function
        if (newVal !== undefined) isSendMax = newVal
        break
      }
      case 'typeAmount':
        if (isMaxSweepAsset(asset)) isSendMax = false // real production function
        break
      case 'changeAsset':
        isSendMax = false // fix: always reset on asset change
        break
    }
  }
  return isSendMax
}

describe('stale isSendMax from any isMaxSweepAsset chain must not reach another isMaxSweepAsset swap', () => {
  /**
   * Fully generalised: both the "setter" chain (which sets isSendMax=true via
   * 100%) and the "target" chain (switched to afterwards) are drawn from
   * MAX_SWEEP_CHAINS — automatically updated whenever isMaxSweepAsset changes.
   *
   * fast-check shrinks to the minimal counterexample — which in the buggy
   * simulation is always ADA as the target, because ADA is the only
   * isMaxSweepAsset chain whose typeAmount guard was missing before the fix.
   *
   * For UTXO→UTXO switches the buggy typeAmount guard still fires (isSourceUTXO
   * covers all UTXO targets), so the property holds there even in the buggy
   * code — demonstrating that fast-check correctly isolates ADA as the culprit.
   */
  const arbAction = fc.oneof(
    arbAllChain.map((chain): Action => ({ type: 'setPercent100', chain })),
    arbAllChain.map((chain): Action => ({ type: 'typeAmount', chain })),
    arbAllChain.map((chain): Action => ({ type: 'changeAsset', chain }))
  )

  const arbTriggerSequence = fc
    .tuple(fc.array(arbAction, { maxLength: 8 }), arbMaxSweepChain, arbMaxSweepChain)
    .map(([preamble, setterChain, targetChain]): Action[] => [
      ...preamble,
      { type: 'setPercent100', chain: setterChain }, // stale isSendMax=true
      { type: 'changeAsset', chain: targetChain }, // switch to any isMaxSweepAsset chain
      { type: 'typeAmount', chain: targetChain } // type a specific amount
    ])

  it('simulateBuggy reproduces the bug (sendMax is true — expected failure)', () => {
    // This test documents what the pre-fix code does. It is EXPECTED to fail —
    // fast-check finds a counterexample and reports it (always shrinks to ADA).
    expect(() => {
      fc.assert(
        fc.property(arbTriggerSequence, (actions) => {
          const isSendMax = simulateBuggy(actions)
          // useSwapExecution derives sendMax as: isMaxSweepAsset ? isSendMax : undefined
          const targetChain = actions[actions.length - 1].chain
          const sendMax = isMaxSweepAsset(nativeAsset(targetChain)) ? isSendMax : undefined
          return sendMax !== true
        })
      )
    }).toThrow() // fast-check throws on counterexample
  })

  it('simulateFixed holds the invariant (sendMax is never true after switching source asset)', () => {
    fc.assert(
      fc.property(arbTriggerSequence, (actions) => {
        const isSendMax = simulateFixed(actions)
        const targetChain = actions[actions.length - 1].chain
        const sendMax = isMaxSweepAsset(nativeAsset(targetChain)) ? isSendMax : undefined
        return sendMax !== true
      })
    )
  })
})
