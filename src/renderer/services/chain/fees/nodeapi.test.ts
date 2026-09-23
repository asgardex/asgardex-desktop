import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { Chain } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { describe, expect, it } from 'vitest'

import { ChainFeeData, getUtxoMinFeeRate, resolveUtxoFeeRate, UTXO_MAX_FEE_RATES, UTXO_MIN_FEE_RATES } from './nodeapi'

const feeData = (chain: Chain, gas_rate: string): O.Option<ChainFeeData> =>
  O.some({ chain, gas_rate, gas_rate_units: 'satsperbyte', outbound_fee: '0' })

describe('resolveUtxoFeeRate', () => {
  describe('inbounds (node gas_rate applies)', () => {
    it('raises a provider estimate up to the node gas_rate', () => {
      // the exact conditions of the 2026-07-17 stuck swap: BitGo said 0.986, THORNode said 3
      expect(resolveUtxoFeeRate(BCHChain, 0.986, feeData(BCHChain, '3'))).toEqual(3)
    })

    it.each([
      // chain, provider estimate, node gas_rate, expected  (live values, 2026-07-31)
      ['BTC', 2.234, '3', 3],
      ['BCH', 1.5, '3', 3],
      ['LTC', 0.825, '27', 27],
      ['DOGE', 37500, '750000', 750000],
      ['DASH', 8.25, '12', 12]
    ])('%s: raises %s to the node gas_rate %s', (chain, estimate, gasRate, expected) => {
      expect(
        resolveUtxoFeeRate(chain as Chain, estimate as number, feeData(chain as Chain, gasRate as string))
      ).toEqual(expected)
    })

    it('keeps the provider estimate when it already exceeds the node gas_rate', () => {
      expect(resolveUtxoFeeRate(BCHChain, 12, feeData(BCHChain, '6'))).toEqual(12)
    })

    it('falls back to the clamped estimate on an invalid gas_rate', () => {
      for (const gasRate of ['0', '-1', 'not-a-number', '']) {
        expect(resolveUtxoFeeRate(BCHChain, 0.986, feeData(BCHChain, gasRate))).toEqual(UTXO_MIN_FEE_RATES.BCH)
      }
    })
  })

  describe('ordinary sends (node gas_rate must NOT apply)', () => {
    it('leaves a healthy estimate alone rather than padding it to gas_rate', () => {
      // LTC gas_rate is 27; a plain send at 5 must not be raised 5x
      expect(resolveUtxoFeeRate('LTC', 5, O.none)).toEqual(5)
      expect(resolveUtxoFeeRate('DOGE', 37500, O.none)).toEqual(37500)
    })

    it('still enforces the per-chain relay floor', () => {
      // LTC's provider estimate of 0.825 previously became 0 via Math.floor
      expect(resolveUtxoFeeRate('LTC', 0.825, O.none)).toEqual(UTXO_MIN_FEE_RATES.LTC)
      expect(resolveUtxoFeeRate('DOGE', 10, O.none)).toEqual(UTXO_MIN_FEE_RATES.DOGE)
    })
  })

  describe('upper cap (plausibility gate on bad data)', () => {
    it('ignores an implausible node gas_rate rather than paying it', () => {
      // a decimal-shifted / wrong-unit BCH rate must not be paid, nor clamped to the ceiling
      expect(resolveUtxoFeeRate(BCHChain, 1.5, feeData(BCHChain, '5000000'))).toEqual(2)
      // ...and the local estimate is still honoured when it is the healthier number
      expect(resolveUtxoFeeRate(BCHChain, 40, feeData(BCHChain, '5000000'))).toEqual(40)
    })

    it('still accepts large-but-plausible raises', () => {
      // LTC legitimately runs 33x its provider estimate - the cap must not clamp this
      expect(resolveUtxoFeeRate('LTC', 0.825, feeData('LTC', '27'))).toEqual(27)
      expect(resolveUtxoFeeRate('DOGE', 37500, feeData('DOGE', '750000'))).toEqual(750000)
    })

    it('caps an implausible provider estimate', () => {
      expect(resolveUtxoFeeRate(BCHChain, 1e9, O.none)).toEqual(UTXO_MAX_FEE_RATES.BCH)
    })

    it('holds BTC to a tighter ceiling, since its unit price makes the worst case ~300x costlier', () => {
      expect(UTXO_MAX_FEE_RATES.BTC).toEqual(300)
      // congestion-level but plausible - must still be honoured
      expect(resolveUtxoFeeRate('BTC', 5, feeData('BTC', '250'))).toEqual(250)
      // above the ceiling - treated as bad data, falls back to the estimate
      expect(resolveUtxoFeeRate('BTC', 5, feeData('BTC', '500'))).toEqual(5)
    })

    it('never exceeds the chain ceiling for any input', () => {
      for (const chain of ['BTC', 'BCH', 'LTC', 'DOGE', 'DASH']) {
        for (const estimate of [0, 1e9, Number.POSITIVE_INFINITY]) {
          for (const gasRate of ['1', '1e12', '999999999999']) {
            expect(resolveUtxoFeeRate(chain, estimate, feeData(chain, gasRate))).toBeLessThanOrEqual(
              UTXO_MAX_FEE_RATES[chain]
            )
          }
        }
      }
    })
  })

  it('always returns a whole number at or above the chain floor', () => {
    for (const chain of ['BTC', 'BCH', 'LTC', 'DOGE', 'DASH']) {
      for (const estimate of [Number.NaN, -5, 0, 0.4, 3.2]) {
        const rate = resolveUtxoFeeRate(chain, estimate, O.none)
        expect(Number.isInteger(rate)).toBe(true)
        expect(rate).toBeGreaterThanOrEqual(getUtxoMinFeeRate(chain))
      }
    }
  })
})
