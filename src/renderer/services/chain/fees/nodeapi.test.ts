import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { FeesWithRates } from '@xchainjs/xchain-client'
import { DASHChain } from '@xchainjs/xchain-dash'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount, baseAmount, Chain } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { describe, expect, it } from 'vitest'

import {
  ChainFeeData,
  estimateUtxoInboundFee,
  utxoSendSize,
  getInboundNodeProtocol,
  getUtxoMinFeeRate,
  NodeProtocol,
  resolveUtxoFeeRate,
  UTXO_MAX_FEE_RATES,
  UTXO_MIN_FEE_RATES
} from './nodeapi'

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

describe('getInboundNodeProtocol', () => {
  it('uses the protocol the inbound is going to, not the chain default', () => {
    // BTC is served by both protocols and their vaults publish different gas_rates
    expect(getInboundNodeProtocol(BTCChain, MAYAChain)).toEqual(NodeProtocol.MAYACHAIN)
    expect(getInboundNodeProtocol(BTCChain, THORChain)).toEqual(NodeProtocol.THORCHAIN)
  })

  it('falls back to the chain default when the protocol is unknown', () => {
    expect(getInboundNodeProtocol(BCHChain)).toEqual(NodeProtocol.THORCHAIN)
    expect(getInboundNodeProtocol(DASHChain)).toEqual(NodeProtocol.MAYACHAIN)
    expect(getInboundNodeProtocol(BCHChain, BTCChain)).toEqual(NodeProtocol.THORCHAIN)
  })
})

describe('estimateUtxoInboundFee', () => {
  const FLOOR = 1000 // xchainjs MIN_TX_FEE for BTC / LTC
  // Models xchainjs `getFeeFromUtxos`: fee = max(vbytes * rate, 1000). `fast` is the swap option;
  // average / fastest sit either side.
  const withRates = (fast: number, vbytes: number, floor = FLOOR): FeesWithRates => {
    const rates = { average: fast * 0.5, fast, fastest: fast * 2 }
    const fee = (rate: number) => baseAmount(Math.max(vbytes * rate, floor), 8)
    return {
      rates,
      fees: { average: fee(rates.average), fast: fee(rates.fast), fastest: fee(rates.fastest) }
    }
  }
  // Realistic: rates and floored fees only; the provider's own size guess is irrelevant when utxoCount is known
  const flooredRates = (fast: number): FeesWithRates => withRates(fast, 150)
  const estimate = (
    chain: Chain,
    fees: FeesWithRates,
    data: O.Option<ChainFeeData>,
    extra: { utxoCount?: number; hasMemo?: boolean; sendMax?: boolean } = {}
  ) =>
    estimateUtxoInboundFee({ chain, feesWithRates: fees, oFeeData: data, ...extra })
      .amount()
      .toNumber()

  describe('utxoSendSize (mirrors the xchainjs selector: 10 + 68 / input + 31 / output)', () => {
    it('counts recipient + memo + change for a normal send', () => {
      expect(utxoSendSize({ inputCount: 1, hasMemo: true, sendMax: false })).toEqual(10 + 68 + 93)
    })
    it('has no change output for a MAX sweep (reference tx 90130e97..dfa: 3 inputs, 2 outputs = 276 vB)', () => {
      expect(utxoSendSize({ inputCount: 3, hasMemo: true, sendMax: true })).toEqual(276)
    })
    it('has no memo output for a plain transfer', () => {
      expect(utxoSendSize({ inputCount: 2, hasMemo: false, sendMax: false })).toEqual(10 + 136 + 62)
    })
  })

  describe('UTXO count known', () => {
    it('MAX sweep of 3 UTXOs at THOR gas_rate 3 matches what the send pays (276 vB * 3 = 828)', () => {
      expect(estimate(BTCChain, flooredRates(3), feeData(BTCChain, '3'), { utxoCount: 3, sendMax: true })).toEqual(828)
      // MAYA gas_rate 1 is below the provider rate: the provider rate (3) wins
      expect(estimate(BTCChain, flooredRates(3), feeData(BTCChain, '1'), { utxoCount: 3, sendMax: true })).toEqual(828)
    })

    it('normal send of 3 UTXOs is an upper bound that includes change (307 vB * 3 = 921)', () => {
      expect(estimate(BTCChain, flooredRates(3), feeData(BTCChain, '3'), { utxoCount: 3 })).toEqual(921)
    })

    it('1 UTXO at rate 3: 171 vB with change (513), 140 vB when swept (420)', () => {
      expect(estimate(BTCChain, flooredRates(3), feeData(BTCChain, '3'), { utxoCount: 1 })).toEqual(513)
      expect(estimate(BTCChain, flooredRates(3), feeData(BTCChain, '3'), { utxoCount: 1, sendMax: true })).toEqual(420)
    })

    it('is not inflated when every provider tier is floored (rates {1,1,1}, plain transfer, min rate 2)', () => {
      const allFloored: FeesWithRates = {
        rates: { average: 1, fast: 1, fastest: 1 },
        fees: { average: baseAmount(1000, 8), fast: baseAmount(1000, 8), fastest: baseAmount(1000, 8) }
      }
      // rate raised to the BTC relay minimum 2; 1 UTXO, no memo, with change: 10 + 68 + 62 = 140 vB
      expect(estimate(BTCChain, allFloored, O.none, { utxoCount: 1, hasMemo: false })).toEqual(280)
      // the FeesWithRates-only fallback would have said 1000 vB * 2 = 2000
      expect(estimate(BTCChain, allFloored, O.none)).toEqual(2000)
    })

    it('scales with many inputs (N = 20 SegWit, non-max): 10 + 1360 + 93 = 1463 vB at rate 4 = 5852', () => {
      expect(estimate(BTCChain, flooredRates(4), feeData(BTCChain, '2'), { utxoCount: 20 })).toEqual(5852)
    })

    it('prices Taproot inputs like the selector (68 vB), not below what the send pays', () => {
      expect(estimate(BTCChain, flooredRates(3), feeData(BTCChain, '3'), { utxoCount: 2, sendMax: true })).toEqual(
        (10 + 136 + 62) * 3
      )
    })

    it('raises the estimate when the vault gas_rate is above the provider rate', () => {
      expect(estimate(BTCChain, flooredRates(3), feeData(BTCChain, '10'), { utxoCount: 3, sendMax: true })).toEqual(
        2760
      )
    })

    it('rounds a fractional rate up to a whole number, as the send does', () => {
      expect(estimate(BTCChain, flooredRates(2.4), feeData(BTCChain, '1'), { utxoCount: 3, sendMax: true })).toEqual(
        828
      )
      expect(estimate(BTCChain, flooredRates(3), feeData(BTCChain, '3.4'), { utxoCount: 3, sendMax: true })).toEqual(
        1104
      )
    })

    it('LTC: sub-1 provider rate 0.825 with gas_rate 61 and 25', () => {
      // 2 UTXOs, memo, change: 10 + 136 + 93 = 239 vB
      expect(estimate(LTCChain, flooredRates(0.825), feeData(LTCChain, '61'), { utxoCount: 2 })).toEqual(239 * 61)
      expect(estimate(LTCChain, flooredRates(0.825), feeData(LTCChain, '25'), { utxoCount: 2 })).toEqual(239 * 25)
    })

    it('BCH uses the same selector constants (no floor)', () => {
      expect(estimate(BCHChain, withRates(3, 276, 0), O.none, { utxoCount: 3, sendMax: true })).toEqual(828)
    })
  })

  describe('UTXO count unknown (size derived from the provider FeesWithRates)', () => {
    it('reads the exact size when an option is above the floor, ignoring MAYA gas_rate 1 (THOR 3, provider 3)', () => {
      // 276 vB: fastest (rate 6) = 1656 > floor
      const fees = withRates(3, 276)
      expect(fees.fees.fast.amount().toNumber()).toEqual(1000) // provider reports the floor, not 828
      expect(estimate(BTCChain, fees, feeData(BTCChain, '3'))).toEqual(828)
      expect(estimate(BTCChain, fees, feeData(BTCChain, '1'))).toEqual(828)
    })

    it('falls back to the bound floor / highest rate when every option is floored: provider 2, gas_rate 6, 200 vB', () => {
      // fast 400 and fastest 800 are both reported as 1000: bound 1000 / 4 = 250 vB -> 1500, above the 1200 paid
      expect(estimate(BTCChain, withRates(2, 200), feeData(BTCChain, '6'))).toEqual(1500)
    })

    it('uses LTC gas_rate 25 against a sub-1 provider rate (0.825)', () => {
      // 400 vB: fastest 1.65 -> 660, floored. Bound 1000 / 1.65 -> 607 vB; paid by a 400 vB send: 10000
      expect(estimate(LTCChain, withRates(0.825, 400), feeData(LTCChain, '25'))).toEqual(15175)
      // 800 vB lifts fastest above the floor and gives the exact size
      expect(estimate(LTCChain, withRates(0.825, 800), feeData(LTCChain, '25'))).toEqual(20000)
    })

    it('plain transfer: provider rate clamped to the chain minimum (BTC 2)', () => {
      expect(estimate(BTCChain, withRates(3, 276), O.none)).toEqual(828)
      expect(estimate(BTCChain, withRates(1, 600), O.none)).toEqual(1200) // exact size 600 vB (fastest 1200 > floor)
    })

    it('has no floor on BCH', () => {
      expect(estimate(BCHChain, withRates(3, 276, 0), O.none)).toEqual(828)
    })
  })

  describe('unusable input', () => {
    it('returns the provider fee when the reference rate is unusable', () => {
      const fees = withRates(0, 276)
      expect(estimateUtxoInboundFee({ chain: BTCChain, feesWithRates: fees, oFeeData: O.none })).toBe(fees.fees.fast)
    })

    it('returns the provider fee when no option has a usable rate (no Math.max of an empty list)', () => {
      const nanFee = { ...baseAmount(1, 8), amount: () => ({ toNumber: () => NaN }) } as unknown as BaseAmount
      const fees: FeesWithRates = {
        rates: { average: 0, fast: 3, fastest: 0 },
        fees: { average: baseAmount(1000, 8), fast: nanFee, fastest: baseAmount(1000, 8) }
      }
      expect(estimateUtxoInboundFee({ chain: BTCChain, feesWithRates: fees, oFeeData: O.none })).toBe(fees.fees.fast)
    })

    it('ignores a zero utxoCount and uses the fallback', () => {
      expect(estimate(BTCChain, withRates(3, 276), feeData(BTCChain, '3'), { utxoCount: 0 })).toEqual(828)
    })
  })
})
