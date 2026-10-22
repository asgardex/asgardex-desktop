import { enqueueLimitEvent, limitPayCheck, limitTriggerAction, quoteFillsLimit, settleLimitQueue } from './limitFill'

describe('quoteFillsLimit', () => {
  it('rejects a sell pair quote that returns less than the limit', () => {
    expect(quoteFillsLimit({ side: 'sell', unit: 'pair', limit: 0.03, chartAmount: 1, counterAmount: 0.025 })).toBe(
      false
    )
    expect(quoteFillsLimit({ side: 'sell', unit: 'pair', limit: 0.03, chartAmount: 1, counterAmount: 0.031 })).toBe(
      true
    )
  })

  it('rejects a buy pair quote that costs more than the limit', () => {
    expect(quoteFillsLimit({ side: 'buy', unit: 'pair', limit: 0.03, chartAmount: 1, counterAmount: 0.04 })).toBe(false)
    expect(quoteFillsLimit({ side: 'buy', unit: 'pair', limit: 0.03, chartAmount: 1, counterAmount: 0.02 })).toBe(true)
  })

  it('converts a USD sell through the counter pool price', () => {
    // 0.025 BTC * $100000 / 1 ETH = $2500. The limit is $2600.
    expect(
      quoteFillsLimit({
        side: 'sell',
        unit: 'usd',
        limit: 2600,
        chartAmount: 1,
        counterAmount: 0.025,
        counterUsd: 100000
      })
    ).toBe(false)
    expect(
      quoteFillsLimit({
        side: 'sell',
        unit: 'usd',
        limit: 2400,
        chartAmount: 1,
        counterAmount: 0.025,
        counterUsd: 100000
      })
    ).toBe(true)
  })

  it('converts a USD buy through the counter pool price', () => {
    // 100 USDC * $1 / 0.04 ETH = $2500, worse than a $2400 ceiling.
    expect(
      quoteFillsLimit({ side: 'buy', unit: 'usd', limit: 2400, chartAmount: 0.04, counterAmount: 100, counterUsd: 1 })
    ).toBe(false)
    expect(
      quoteFillsLimit({ side: 'buy', unit: 'usd', limit: 2600, chartAmount: 0.04, counterAmount: 100, counterUsd: 1 })
    ).toBe(true)
  })

  it('waits when a USD quote has no counter price', () => {
    expect(quoteFillsLimit({ side: 'sell', unit: 'usd', limit: 2400, chartAmount: 1, counterAmount: 0.025 })).toBeNull()
    expect(quoteFillsLimit({ side: 'sell', unit: 'pair', limit: 0.03, chartAmount: 0, counterAmount: 1 })).toBeNull()
  })
})

describe('limitTriggerAction', () => {
  it('confirms a fill and never submits on its own', () => {
    expect(limitTriggerAction(true)).toBe('confirm')
    expect(limitTriggerAction(false)).toBe('fail')
    expect(limitTriggerAction(null)).toBe('wait')
  })
})

describe('limitPayCheck', () => {
  it('fails a loaded zero balance instead of waiting', () => {
    expect(limitPayCheck(true, false, true)).toBe('balance')
    expect(limitPayCheck(false, false, true)).toBe('wait')
    expect(limitPayCheck(true, true, false)).toBe('route')
    expect(limitPayCheck(true, true, true)).toBe('ok')
  })
})

describe('limit queue', () => {
  it('keeps a second crossing and starts it when the first settles', () => {
    const idle = enqueueLimitEvent(null, [], { levelId: 'a' })
    expect(idle.start?.levelId).toBe('a')
    const queued = enqueueLimitEvent('a', [], { levelId: 'b' })
    expect(queued.start).toBeNull()
    expect(queued.waiting.map((event) => event.levelId)).toEqual(['b'])
    const duplicate = enqueueLimitEvent('a', queued.waiting, { levelId: 'b' })
    expect(duplicate.waiting).toHaveLength(1)
    expect(settleLimitQueue(duplicate.waiting).next?.levelId).toBe('b')
  })
})
