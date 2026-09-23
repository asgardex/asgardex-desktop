import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  createTransactionTrackingService,
  getTxStagesPollingInterval,
  isTxStagesComplete,
  TX_STAGES_ACTIVE_POLL_MS,
  TX_STAGES_LONG_RUNNING_AFTER_MS,
  TX_STAGES_LONG_RUNNING_POLL_MS,
  TX_STAGES_MAX_INCOMPLETE_MS,
  TX_STAGES_MIN_POLL_MS,
  TX_STAGES_QUIET_POLL_MS,
  TX_STAGES_UNKNOWN_POLL_MS
} from './transactionTracking'
import { TxStages } from './types'

const baseStages = (
  overrides: Partial<{
    inboundObserved: boolean
    inboundFinalised: boolean
    swapFinalised: boolean
    outboundSigned?: boolean
    pending: boolean
    remainingConfirmationSeconds?: number
    remainDelaySeconds?: number
    streamCount?: number
    streamQuantity?: number
  }>
): TxStages => ({
  inboundObserved: {
    finalCount: 1,
    completed: overrides.inboundObserved ?? false
  },
  inboundConfirmationCounted: {
    remainingConfirmationSeconds: overrides.remainingConfirmationSeconds,
    completed: !(overrides.remainingConfirmationSeconds && overrides.remainingConfirmationSeconds > 0)
  },
  inboundFinalised: {
    completed: overrides.inboundFinalised ?? false
  },
  outBoundDelay: {
    remainDelaySeconds: overrides.remainDelaySeconds,
    remainingDelayBlocks: undefined,
    completed: !(overrides.remainDelaySeconds && overrides.remainDelaySeconds > 0)
  },
  outboundSigned: {
    scheduledOutboundHeight: undefined,
    blocksSinceScheduled: undefined,
    completed: overrides.outboundSigned
  },
  swapStatus: {
    pending: overrides.pending ?? false,
    streaming: {
      interval: 1,
      quantity: overrides.streamQuantity,
      count: overrides.streamCount
    }
  },
  swapFinalised: overrides.swapFinalised ?? false
})

describe('getTxStagesPollingInterval', () => {
  it('uses unknown interval when stages are null', () => {
    expect(getTxStagesPollingInterval(null)).toBe(TX_STAGES_UNKNOWN_POLL_MS)
  })

  it('never polls faster than one THOR block (~6s) during confirmations', () => {
    const stages = baseStages({ remainingConfirmationSeconds: 30 })
    expect(getTxStagesPollingInterval(stages)).toBe(TX_STAGES_MIN_POLL_MS)
    expect(getTxStagesPollingInterval(stages)).toBeGreaterThanOrEqual(6000)
  })

  it('uses min interval during outbound delay', () => {
    expect(getTxStagesPollingInterval(baseStages({ remainDelaySeconds: 12 }))).toBe(TX_STAGES_MIN_POLL_MS)
  })

  it('uses active interval while streaming', () => {
    expect(getTxStagesPollingInterval(baseStages({ streamCount: 1, streamQuantity: 10, inboundObserved: true }))).toBe(
      TX_STAGES_ACTIVE_POLL_MS
    )
  })

  it('uses quiet interval near completion', () => {
    expect(
      getTxStagesPollingInterval(
        baseStages({
          inboundObserved: true,
          inboundFinalised: true,
          swapFinalised: true,
          outboundSigned: false
        })
      )
    ).toBe(TX_STAGES_QUIET_POLL_MS)
  })

  it('backs off for long-running incomplete tracking', () => {
    expect(getTxStagesPollingInterval(baseStages({ pending: true }), TX_STAGES_LONG_RUNNING_AFTER_MS)).toBe(
      TX_STAGES_LONG_RUNNING_POLL_MS
    )
  })
})

describe('isTxStagesComplete', () => {
  it('returns false for null stages', () => {
    expect(isTxStagesComplete(null)).toBe(false)
  })

  it('returns true when all required stages complete and no outbound needed', () => {
    expect(
      isTxStagesComplete(
        baseStages({
          inboundObserved: true,
          inboundFinalised: true,
          swapFinalised: true,
          outboundSigned: undefined
        })
      )
    ).toBe(true)
  })

  it('requires outbound when outboundSigned.completed is defined', () => {
    expect(
      isTxStagesComplete(
        baseStages({
          inboundObserved: true,
          inboundFinalised: true,
          swapFinalised: true,
          outboundSigned: false
        })
      )
    ).toBe(false)

    expect(
      isTxStagesComplete(
        baseStages({
          inboundObserved: true,
          inboundFinalised: true,
          swapFinalised: true,
          outboundSigned: true
        })
      )
    ).toBe(true)
  })
})

describe('createTransactionTrackingService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls only terminal RD values (ignores pending) and respects min interval', async () => {
    let calls = 0
    const getTxStatus$ = (_txHash: string) => {
      calls++
      return Rx.concat(
        Rx.of(RD.pending),
        Rx.of(
          RD.success(
            baseStages({
              inboundObserved: false,
              remainingConfirmationSeconds: 20
            })
          )
        )
      )
    }

    const service = createTransactionTrackingService(getTxStatus$, 30, TX_STAGES_MAX_INCOMPLETE_MS)
    const sub = service.getTransactions$.subscribe()

    service.addTransaction({
      txHash: 'abc',
      startTime: Date.now(),
      fromAsset: 'BTC.BTC',
      toAsset: 'THOR.RUNE',
      amount: '1'
    })

    // First poll is immediate
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(1)

    // Pending must not schedule an extra immediate poll — next wait is min 6s
    await vi.advanceTimersByTimeAsync(TX_STAGES_MIN_POLL_MS - 1)
    expect(calls).toBe(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toBe(2)

    sub.unsubscribe()
  })

  it('stops polling after max incomplete age', async () => {
    let calls = 0
    const getTxStatus$ = (_txHash: string) => {
      calls++
      return Rx.of(RD.success(baseStages({ inboundObserved: false })))
    }

    const maxIncomplete = 60_000
    const service = createTransactionTrackingService(getTxStatus$, 30, maxIncomplete)
    const sub = service.getTransactions$.subscribe()

    const start = Date.now()
    service.addTransaction({
      txHash: 'stuck',
      startTime: start,
      fromAsset: 'BTC.BTC',
      toAsset: 'THOR.RUNE',
      amount: '1'
    })

    await vi.advanceTimersByTimeAsync(0)
    const afterFirst = calls
    expect(afterFirst).toBeGreaterThanOrEqual(1)

    // Run past max incomplete window
    await vi.advanceTimersByTimeAsync(maxIncomplete + TX_STAGES_UNKNOWN_POLL_MS)
    const callsAtStop = calls

    await vi.advanceTimersByTimeAsync(TX_STAGES_UNKNOWN_POLL_MS * 3)
    expect(calls).toBe(callsAtStop)

    sub.unsubscribe()
  })
})
