import { assetsToPoll, levelComparablePrice, nextCrossings } from './crossings'
import type { PriceLevel } from './types'

const level = (overrides: Partial<PriceLevel> & Pick<PriceLevel, 'id' | 'price' | 'type'>): PriceLevel => ({
  amount: 1,
  amountSymbol: 'ETH',
  targetAssetKey: 'BTC.BTC',
  status: 'pending',
  ...overrides
})

const empty = { seen: new Set<string>(), prev: {} }

describe('levelComparablePrice', () => {
  it('uses pool USD for a USD level', () => {
    const usd = level({ id: 'u', price: 2400, type: 'sell' })
    expect(levelComparablePrice(usd, 'ETH.ETH', { 'ETH.ETH': 2500 })).toBe(2500)
  })

  it('uses counter units per chart asset for a pair level', () => {
    const pair = level({ id: 'p', price: 0.03, type: 'sell', unit: 'pair', counterAssetKey: 'BTC.BTC' })
    // ETH $2500 / BTC $100000 = 0.025 BTC per ETH
    expect(levelComparablePrice(pair, 'ETH.ETH', { 'ETH.ETH': 2500, 'BTC.BTC': 100000 })).toBeCloseTo(0.025)
  })

  it('waits until both pool prices exist', () => {
    const pair = level({ id: 'p', price: 0.03, type: 'sell', unit: 'pair', counterAssetKey: 'BTC.BTC' })
    expect(levelComparablePrice(pair, 'ETH.ETH', { 'ETH.ETH': 2500 })).toBeNull()
  })
})

describe('nextCrossings', () => {
  it('fires a buy on the first price that is already at or below the level', () => {
    const buy = level({ id: 'buy', price: 100, type: 'buy' })
    const result = nextCrossings({ 'ETH.ETH': [buy] }, { 'ETH.ETH': 95 }, empty)
    expect(result.hits.map((hit) => hit.levelId)).toEqual(['buy'])
    expect(result.hits[0].currentPrice).toBe(95)
  })

  it('keeps a second crossing when the first level is no longer pending', () => {
    const first = level({ id: 'a', price: 100, type: 'buy', status: 'executing' })
    const second = level({ id: 'b', price: 100, type: 'buy' })
    const seen = nextCrossings({ 'ETH.ETH': [first, second] }, { 'ETH.ETH': 110 }, empty)
    expect(seen.hits).toHaveLength(0)
    const crossed = nextCrossings({ 'ETH.ETH': [first, second] }, { 'ETH.ETH': 90 }, seen.state)
    expect(crossed.hits.map((hit) => hit.levelId)).toEqual(['b'])
  })

  it('does not fire a pair order when only the chart asset USD crosses', () => {
    const pair = level({ id: 'p', price: 0.03, type: 'sell', unit: 'pair', counterAssetKey: 'BTC.BTC' })
    const first = nextCrossings({ 'ETH.ETH': [pair] }, { 'ETH.ETH': 2500, 'BTC.BTC': 100000 }, empty)
    expect(first.hits).toHaveLength(0)
    // ETH USD rises, and BTC rises with it, so the ratio stays 0.025.
    const moved = nextCrossings({ 'ETH.ETH': [pair] }, { 'ETH.ETH': 3000, 'BTC.BTC': 120000 }, first.state)
    expect(moved.hits).toHaveLength(0)
  })

  it('fires a pair sell when the ratio rises through the entered price', () => {
    const pair = level({ id: 'p', price: 0.03, type: 'sell', unit: 'pair', counterAssetKey: 'BTC.BTC' })
    const first = nextCrossings({ 'ETH.ETH': [pair] }, { 'ETH.ETH': 2500, 'BTC.BTC': 100000 }, empty)
    const crossed = nextCrossings({ 'ETH.ETH': [pair] }, { 'ETH.ETH': 4000, 'BTC.BTC': 100000 }, first.state)
    expect(crossed.hits).toHaveLength(1)
    expect(crossed.hits[0].currentPrice).toBeCloseTo(0.04)
  })

  it('treats a rearmed level as first-seen', () => {
    const buy = level({ id: 'buy', price: 100, type: 'buy' })
    const armed = nextCrossings({ 'ETH.ETH': [buy] }, { 'ETH.ETH': 110 }, empty)
    expect(armed.hits).toHaveLength(0)
    const again = nextCrossings({ 'ETH.ETH': [buy] }, { 'ETH.ETH': 90 }, empty)
    expect(again.hits.map((hit) => hit.levelId)).toEqual(['buy'])
  })
})

describe('assetsToPoll', () => {
  it('includes a pair counter and skips paused levels', () => {
    const pair = level({ id: 'p', price: 0.03, type: 'sell', unit: 'pair', counterAssetKey: 'BTC.BTC' })
    const paused = level({ id: 'x', price: 1, type: 'buy', status: 'paused' })
    expect(assetsToPoll({ 'ETH.ETH': [pair], 'DOGE.DOGE': [paused] })).toEqual(['ETH.ETH', 'BTC.BTC'])
  })
})
