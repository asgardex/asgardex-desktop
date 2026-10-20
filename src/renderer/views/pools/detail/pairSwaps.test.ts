import { assetFromString, baseAmount, AssetType } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { pairSwapDirection, rowsForPair, type PairSwapAction, type PairSwapTracked } from './pairSwaps'

const rune = assetFromString('THOR.RUNE')!
const usdc = assetFromString('ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')!
const btc = assetFromString('BTC.BTC')!
const tradeUsdc = { ...usdc, type: AssetType.TRADE }

const action = (partial: PairSwapAction): PairSwapAction => partial

describe('pairSwapDirection', () => {
  it('shows a sell as chart asset into the counter', () => {
    expect(pairSwapDirection('sell', '25.55 RUNE', '16.29 USDC')).toEqual({
      spent: '25.55 RUNE',
      received: '16.29 USDC'
    })
  })

  it('shows a buy as counter into the chart asset', () => {
    expect(pairSwapDirection('buy', '15 RUNE', '10 USDC')).toEqual({
      spent: '10 USDC',
      received: '15 RUNE'
    })
  })
})

describe('rowsForPair', () => {
  const sell: PairSwapAction = action({
    date: new Date('2026-10-01T00:00:00Z'),
    type: 'SWAP',
    in: [{ txID: 'IN1', values: [{ asset: rune, amount: baseAmount(2_555_000_000, 8) }] }],
    out: [{ txID: 'OUT1', values: [{ asset: usdc, amount: baseAmount(1_629_000_000, 8) }] }]
  })

  it('reads a sell of the chart asset into the counter', () => {
    const [row] = rowsForPair([sell], [], rune, usdc)
    expect(row).toMatchObject({
      id: 'in1',
      side: 'sell',
      size: '25.55',
      counter: '16.29',
      counterTicker: 'USDC',
      status: 'completed'
    })
  })

  it('reads a buy when the chart asset is the outbound', () => {
    const buy: PairSwapAction = action({
      date: new Date('2026-10-02T00:00:00Z'),
      type: 'SWAP',
      in: [{ txID: 'IN2', values: [{ asset: usdc, amount: baseAmount(1_000_000_000, 8) }] }],
      out: [{ txID: 'OUT2', values: [{ asset: rune, amount: baseAmount(1_500_000_000, 8) }] }]
    })
    const [row] = rowsForPair([buy], [], rune, usdc)
    expect(row.side).toBe('buy')
    expect(row.size).toBe('15')
    expect(row.counter).toBe('10')
  })

  it('keeps a trade-asset counter on the same pair', () => {
    const [row] = rowsForPair([sell], [], rune, tradeUsdc)
    expect(row?.counterTicker).toBe('USDC')
    expect(row?.side).toBe('sell')
  })

  it('drops swaps of a different counter', () => {
    expect(rowsForPair([sell], [], rune, btc)).toEqual([])
  })

  it('marks a refund as failed', () => {
    const refund: PairSwapAction = action({
      ...sell,
      type: 'REFUND',
      out: [{ txID: 'OUT1', values: [{ asset: usdc, amount: baseAmount(1, 8) }] }]
    })
    expect(rowsForPair([refund], [], rune, usdc)[0]?.status).toBe('failed')
  })

  it('puts a tracked swap first and hides it once the action arrives', () => {
    const live: PairSwapTracked = {
      txHash: 'LIVE',
      startTime: new Date('2026-10-03T00:00:00Z').getTime(),
      fromAsset: 'THOR.RUNE',
      toAsset: 'ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      isComplete: false
    }
    const [pending] = rowsForPair([sell], [live], rune, usdc)
    expect(pending).toMatchObject({ id: 'live', side: 'sell', status: 'pending', size: null })

    const settled: PairSwapTracked = { ...live, txHash: 'IN1', isComplete: true }
    const rows = rowsForPair([sell], [settled], rune, usdc)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.size).toBe('25.55')
  })

  it('orders newest first', () => {
    const later: PairSwapAction = action({
      date: new Date('2026-10-05T00:00:00Z'),
      type: 'SWAP',
      in: [{ txID: 'IN3', values: [{ asset: rune, amount: baseAmount(100_000_000, 8) }] }],
      out: [{ txID: 'OUT3', values: [{ asset: usdc, amount: baseAmount(100_000_000, 8) }] }]
    })
    const rows = rowsForPair([sell, later], [], rune, usdc)
    expect(rows.map((row) => row.id)).toEqual(['in3', 'in1'])
  })
})
